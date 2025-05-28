---
title:  "Spring Data JPA에서 새로운 Entity인지 판단하는 방법"
tag: [Spring, JPA, Interview]
layout: post
description: Entity의 새로운 여부 판단 정리
image: '/images/2025-03-13-JPA_Entity/image.png'
tags_color: '#ff4500'
---

## Entity의 새로운 여부 판단 정리

```java
@Override
public boolean isNew(T entity) {

    if(versionAttribute.isEmpty()
          || versionAttribute.map(Attribute::getJavaType).map(Class::isPrimitive).orElse(false)) {
        return super.isNew(entity);
    }

    BeanWrapper wrapper = new DirectFieldAccessFallbackBeanWrapper(entity);

    return versionAttribute.map(it -> wrapper.getPropertyValue(it.getName()) == null).orElse(true);
}
```

- Entity가 새로운 지 여부는 JpaEntityInformation의 isNew(T entity) 메서드를 통해 판단이 된다.
- 별도의 설정이 없으면 JpaMetamodelEntityInformation이 동작한다.
- @Version 필드가 없거나 primitive 타입이면 AbstractEntityInformation의 isNew() 메서드가 호출된다.

### **@Version 필드가 있는 경우 (JpaMetamodelEntityInformation 동작)**

- @Version 필드가 Wrapper 클래스(Integer, Long 등)일 경우: 해당 필드 값이 null이면 새로운 엔티티 (isNew() == true)로 판단
  
- @Version 필드가 primitive 타입(int, long 등)일 경우: super.isNew(entity) 호출하여 기본 로직 수행	

###  **@Version 필드가 없는 경우 (AbstractEntityInformation 동작)**

@Id 필드의 타입을 확인하여 새로운 엔티티인지 판단한다.

```java
public boolean isNew(T entity) {
    Id id = getId(entity);
    Class<ID> idType = getIdType();

    if (!idType.isPrimitive()) {
        return id == null;
    }

    if (id instanceof Number) {
        return ((Number) id).longValue() == 0L;
    }

    throw new IllegalArgumentException(String.format("Unsupported primitive id type %s", idType));
}

```

판단 방식:

1. **@Id 필드가 primitive 타입이 아닐 경우 (Long, Integer 등)**
    → id == null이면 새로운 엔티티(isNew() == true)
2. **@Id 필드가 Number의 하위 타입 (e.g., long, int)일 경우**
    → id == 0L이면 새로운 엔티티(isNew() == true)
3. **지원되지 않는 primitive 타입일 경우**
    → 예외 발생.

@GeneratedValue 사용 시 동작 방식

- @GeneratedValue는 **데이터베이스에서 ID를 자동 생성**하는 전략을 사용.
- 따라서 **엔티티가 데이터베이스에 저장되기 전에는 @Id 필드가 null(또는 0)** 상태.
- 결과적으로 **isNew()가 true**로 평가되어 새로운 엔티티로 판단된다.

## 직접 ID를 할당하는 경우에는 어떻게 동작하나요? 🤔

키 생성 전략을 사용하지 않고 직접 ID를 할당하는 경우 새로운 entity로 간주되지 않는다. 이 때는 엔티티에서 Persistable<T> 인터페이스를 구현해서 JpaMetamodelEntityInformation 클래스가 아닌 JpaPersistableEntityInformation의 isNew()가 동작하도록 해야 한다.

=> isNew()의 판단 기준을 엔티티가 직접 제어할 수 있다.

=> isNew()가 엔티티의 isNew()메서드를 직접 호출하여 새로운 엔티티인지 판단하도록 한다.

```java
public class JpaPersistableEntityInformation<T extends Persistable<ID, ID> 
        extends JpaMetamodelEntityInformation<T, ID> {

    public JpaPersistableEntityInformation(Class<T> domainClass, Metamodel metamodel, 
            PersistenceUnitUtil persistenceUnitUtil) {
        super(domainClass, metamodel, persistenceUnitUtil);
    }

    @Override
    public boolean isNew(T entity) {
        return entity.isNew();
    }

    @Nullable
    @Override
    public ID getId(T entity) {
        return entity.getId();
    }
}
```

#### Persistable<T>를 구현한 엔티티 예시

- **엔티티가 직접 isNew() 로직을 구현**하여, ID가 이미 할당된 경우 새로운 엔티티로 간주되지 않도록 할 수 있음.

```java
import org.springframework.data.domain.Persistable;

@Entity
public class MyEntity implements Persistable<String> {

    @Id
    private String id;

    @Transient
    private boolean isNew = true;

    protected MyEntity() {}

    public MyEntity(String id) {
        this.id = id;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    public void markNotNew() {
        this.isNew = false;
    }
}

```

**새로운 엔티티(`isNew() == true`)로 판단되는 경우**

- id가 직접 할당되었더라도 isNew 필드가 true일 때.
- markNotNew()가 실행되기 전에는 새로운 엔티티로 간주됨.

**데이터베이스에서 로드되었거나 저장된 후에는 isNew() == false가 됨.**

- @PostPersist와 @PostLoad를 사용하여 isNew 플래그를 false로 변경.


<br>

### 새로운 Entity인지 판단하는게 왜 중요할까요? 🤓

```java
@Override
@Transactional
public <S extends T> S save(S entity) {

    Assert.notNull(entity, "Entity must not be null");

	if (entityInformation.isNew(entity)) {
		entityManager.persist(entity);
		return entity;
	} else {
		return entityManager.merge(entity);
	}
}
```

SimpleJpaRepository의 save() 메서드에서 isNew()를 사용하여 persist를 수행할지 merge를 수행할지 결정한다. 

만약 ID를 직접 지정해주는 경우에는 신규 entity라고 판단하지 않기 때문에 merge를 수행한다. 

이때 해당 entity는 신규임에도 불구하고 DB를 조회하기 때문에 비효율적이며, 따라서 새로운 entity인지 판단하는 것은 중요한 부분이다.
