---
title:  "MyBatis의 update는 왜 int를 반환할까?"
tag: [MyBatis, BackEnd]
layout: post
description: MyBatis 동작방식 정리
image: '/images/2025-03-15-MyBatis_update/img.png'
tags_color: '#3eb99a'
featured: true
---

## MyBatis @Mapper와 @Update Annotation 동작 방식 정리

### 단순한 Mapper 인터페이스

```java
@Mapper
public interface UserDao {
    @Update("UPDATE user SET name=#{name} WHERE id=#{id}")
    int updateUser(@Param("id") int id, @Param("name") String name);
}
```

위 코드는  **MyBatis에서 사용되는 Mapper 인터페이스**로, `@Mapper`와 `@Update` 어노테이션을 활용하여 SQL 문을 직접 선언하고 있습니다. 중요한 점은 **인터페이스에 대한 구현체를 작성하지 않았음에도 실행이 가능**하다는 것입니다.

### Annotation의 역할과 동작 방식 분석

- Annotation을 통한 프록시 객체 생성

  많은 사람들이 `@Update` 같은 Annotation을 보고 **"이것이 인터페이스 메서드를 프록시 객체로 변환하는 역할을 한다!"** 라고 생각할 수 있습니다.

  이는 **일반적인 AOP(Aspect-Oriented Programming) 방식의 프록시 패턴**과 유사해 보이지만, 실제로는 조금 다르게 동작합니다.

- `@Update` Annotation 분석

  ```java
  @Retention(RetentionPolicy.RUNTIME)
  @Target(ElementType.METHOD)
  public @interface Update {
    String[] value();
  }
  ```

  **(1) `@Retention(RetentionPolicy.RUNTIME)`**

  - 이 Annotation이 **런타임까지 유지됨**을 의미합니다.
  - 즉, **Reflection을 통해 실행 중에도 이 Annotation의 정보를 읽고 활용할 수 있음**을 보장합니다.

  **(2) `@Target(ElementType.METHOD)`**

  - 이 Annotation이 **메서드에만 적용될 수 있도록 제한**합니다.
  - 클래스, 필드, 생성자 등에는 사용할 수 없습니다.

  **(3) `String[] value();`**

  - 이 Annotation이 **하나 이상의 문자열 값을 가질 수 있도록 설정**됩니다.
  - `@Update("UPDATE user SET name=#{name} WHERE id=#{id}")` 형태로 SQL을 문자열로 전달할 수 있습니다.

​	Annotation 자체는 **단순한 메타데이터**이며, 이 자체만으로 **코드를 실행하거나 인터페이스의 프록시 객체를 생성하는 기능은 없습니다.**

즉, `@Update` Annotation이 인터페이스 메서드를 자동으로 구현하는 것이 아닙니다.



## 동적 프록시와 MyBatis의 동작 방식

프록시 객체는 컴파일 타임에 만들어진다고 하였습니다. 하지만, Annotation에는 **Runtime에 이 Annotation이 동작한다**고 이야기하고 있습니다.

우선, 이를 **동적 프록시**라고 부릅니다.

### **1. 동적 프록시란?**

기본적으로 **프록시(Proxy)** 란 특정 객체에 대한 **대리 객체**로, 직접 접근하는 대신 프록시 객체를 통해 원하는 기능을 수행하는 구조입니다.

- **정적 프록시(Static Proxy)**:
  - **컴파일 타임에** 미리 생성된 클래스를 사용하여 프록시 역할을 수행합니다.
  - 예제) 개발자가 직접 `UserDaoProxy` 클래스를 만들어 `UserDao`를 감싸서 기능을 추가하는 방식.
- **동적 프록시(Dynamic Proxy)**:
  - **런타임에 Reflection API를 활용하여** 프록시 객체를 생성합니다.
    - 즉, 컴파일 시점이 아닌 프로그램 실행 중에 프록시 객체가 생성된다는 차이가 있습니다.
  - MyBatis, Spring AOP 등에서 사용됩니다.
  - **InvocationHandler 인터페이스를 활용하여 메서드 호출을 가로챕니다**.

### **2. MyBatis에서 동적 프록시가 사용되는 이유**

MyBatis는 **Mapper 인터페이스(UserDao 같은 것)를 동적으로 구현할 필요가 있습니다.**
 즉, `UserDao` 같은 인터페이스를 구현하는 클래스를 **컴파일 타임이 아니라 런타임에 동적으로 생성**합니다.

✔ **동적 프록시를 사용하면?**

- 개발자가 **인터페이스만 정의하면 MyBatis가 알아서 SQL을 실행하는 프록시 객체를 생성**해줍니다.
- **각 메서드에 대한 SQL 실행 로직을 일일이 구현할 필요가 없습니다.**
- **런타임에 동적으로 SQL을 구성**하고, 필요할 때만 실제 쿼리를 실행할 수 있습니다.



## MyBatis의 동작 과정

MyBatis에서 `@Mapper`를 사용하여 동작하는 **Mapper 인터페이스(UserDao 등)의 동적 프록시 생성 및 실행 과정**을 살펴보겠습니다.

### **1. @Mapper Annotation을 통한 등록**

먼저, `@Mapper` 또는 `@MapperScan`을 사용하면 **MyBatis의 `MapperRegistry`에 DAO가 등록**됩니다.

### **2. 동적 프록시 객체 생성**

MyBatis는 **런타임에 `Proxy.newProxyInstance()`를 사용하여 `UserDao`의 프록시 객체를 생성**합니다.

```java
UserDao userDao = (UserDao) Proxy.newProxyInstance(
    UserDao.class.getClassLoader(),  // 클래스 로더
    new Class[] { UserDao.class },   // 인터페이스 목록
    new MapperProxy<>(sqlSession, UserDao.class, methodCache)  // InvocationHandler 구현체
);
```

✔ **MyBatis는 인터페이스(UserDao)를 구현하는 클래스 없이, 동적으로 `MapperProxy` 객체를 생성하여 SQL을 실행하도록 만듭니다.**

✔ 이 과정에서 **InvocationHandler 인터페이스를 구현한 `MapperProxy` 클래스가 핵심적인 역할**을 합니다.

### **3. 사용자가 userDao의 메서드를 호출**

사용자가 다음과 같은 코드를 실행한다고 가정합니다.

```java
int count = userDao.updateUser(1, "John");
```

✔ **이 메서드는 실제 구현체가 없는 상태이지만**, 동적으로 생성된 **프록시 객체가 메서드 호출을 가로채고, `invoke()` 메서드를 실행**합니다. 이때 **Annotation의 정보와 메서드의 파라미터등이 전달**이 됩니다.

### **4. InvocationHandler의 `invoke()`가 호출됨**

실제로는 **Java의 Reflection을 활용하여 `invoke()` 메서드가 실행**됩니다.

```java
public interface InvocationHandler {
    Object invoke(Object proxy, Method method, Object[] args) throws Throwable;
}
```

Proxy는 메서드가 호출된 프록시 인스턴스를 나타내고, method는 호출된 메서드를 나타냅니다. 그리고 args는 메서드가 호출될 때 전달된 인자들의 배열을 나타냅니다.

✔ **`invoke()` 메서드는 다음과 같은 역할을 수행합니다.**

1. `methodCache`를 이용하여 `MapperMethod` 객체를 생성(또는 조회)합니다.
2. `MapperMethod.execute(sqlSession, args)`를 호출하여 실제 SQL을 실행합니다.



## **MyBatis의 실제 구현과 동작 과정 심층 분석**

지금까지 MyBatis의 동작 방식을 단계별로 분석하며 **동적 프록시, SQL 실행 과정, 반환값의 의미**까지 정리했습니다. 이제 이를 명확하게 정리해보겠습니다.

### **1. MyBatis의 `invoke()` 구현 살펴보기**

MyBatis의 `MapperProxy`에서 **인터페이스의 메서드를 호출할 때 동작하는 핵심 메서드**는 `invoke()`입니다.

```java
@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
  try {
    // Object의 기본 메서드(equals, hashCode, toString 등)는 직접 실행
    if (Object.class.equals(method.getDeclaringClass())) {
      return method.invoke(this, args);
    }

    // SQL 실행을 위해 CachedInvoker 사용
    return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
  } catch (Throwable t) {
    throw ExceptionUtil.unwrapThrowable(t);
  }
}
```

보니까 **invoke가 cachedInvoker를 또 호출하고, 그 Invoker 내에서 전달받은 값으로 invoke를 또 호출**합니다.

우선, sqlSession을 호출하는 것을 보니, 자세한 동작까진 알 수 없어도, **쿼리를 실행하기 위해 생성된 sqlSession과 지정해주었던 각종 매개변수를 사용하여 쿼리를 날리겠구나** 생각할 수 있습니다.

그냥 넘어가긴 아쉬우니 조금만 더 설명해보면 실제로는 **MapperProxy의 Invoke -> CachedInvoker -> PlainMethodInvoker.invoke()를 호출** 하게 되는데요.

최종단계에서 호출하는 invoke는 다음과 같이 구현되어 있습니다.

```java
@Override
public Object invoke(Object proxy, Method method, Object[] args, SqlSession sqlSession) throws Throwable {
  return mapperMethod.execute(sqlSession, args);
}
```

### **2. MyBatis의 SQL 실행 과정**

MyBatis의 SQL 실행 과정은 `MapperMethod.execute()`에서 이루어집니다.

이 메서드는 **SQL 명령의 타입(INSERT, UPDATE, DELETE, SELECT 등)에 따라 다른 처리를 수행하는 핵심 메서드** 입니다.

```java
public Object execute(SqlSession sqlSession, Object[] args) {
  Object result;
  switch (command.getType()) {
    case INSERT: {
      Object param = method.convertArgsToSqlCommandParam(args);
      result = rowCountResult(sqlSession.insert(command.getName(), param));
      break;
    }
    case UPDATE: {
      Object param = method.convertArgsToSqlCommandParam(args);
      result = rowCountResult(sqlSession.update(command.getName(), param));
      break;
    }
    case DELETE: {
      Object param = method.convertArgsToSqlCommandParam(args);
      result = rowCountResult(sqlSession.delete(command.getName(), param));
      break;
    }
    case SELECT:
      if (method.returnsVoid() && method.hasResultHandler()) {
        executeWithResultHandler(sqlSession, args);
        result = null;
      } else if (method.returnsMany()) {
        result = executeForMany(sqlSession, args);
      } else if (method.returnsMap()) {
        result = executeForMap(sqlSession, args);
      } else if (method.returnsCursor()) {
        result = executeForCursor(sqlSession, args);
      } else {
        Object param = method.convertArgsToSqlCommandParam(args);
        result = sqlSession.selectOne(command.getName(), param);
        if (method.returnsOptional() && (result == null || !method.getReturnType().equals(result.getClass()))) {
          result = Optional.ofNullable(result);
        }
      }
      break;
    case FLUSH:
      result = sqlSession.flushStatements();
      break;
    default:
      throw new BindingException("Unknown execution method for: " + command.getName());
  }
  if (result == null && method.getReturnType().isPrimitive() && !method.returnsVoid()) {
    throw new BindingException("Mapper method '" + command.getName()
        + "' attempted to return null from a method with a primitive return type (" + method.getReturnType() + ").");
  }
  return result;
}

```

✔ **핵심 요점**

1. **SQL 실행 유형을 `command.getType()`을 통해 결정** (INSERT, UPDATE, DELETE, SELECT 등).
2. `sqlSession.update(command.getName(), param);` 실행하여 **SQL 실행 후 영향을 받은 행 수 반환**.
3. `rowCountResult(rowCount)`를 호출하여 **정수 값을 반환하도록 변환**.

### **3. `DefaultSqlSession.update()`를 통한 SQL 실행**

MyBatis는 `DefaultSqlSession`에서 SQL 실행을 처리합니다.

```java
@Override
public int update(String statement, Object parameter) {
  try {
    dirty = true;
    MappedStatement ms = configuration.getMappedStatement(statement);
    return executor.update(ms, wrapCollection(parameter));
  } catch (Exception e) {
    throw ExceptionFactory.wrapException("Error updating database. Cause: " + e, e);
  } finally {
    ErrorContext.instance().reset();
  }
}

```

✔ **핵심 요점**

1. `MappedStatement`를 통해 **SQL 실행을 위한 정보(Mapped SQL, 파라미터 매핑 정보 등) 조회**.
2. `executor.update(ms, wrapCollection(parameter));` 호출하여 **실제 SQL 실행**.

### **4. 최종적으로 StatementHandler를 통해 JDBC 실행**

MyBatis는 `StatementHandler`를 통해 **실제 JDBC의 `PreparedStatement.executeUpdate()`**를 실행합니다.

```java
@Override
public int update(Statement statement) throws SQLException {
  PreparedStatement ps = (PreparedStatement) statement;
  ps.execute();
  int rows = ps.getUpdateCount();
  Object parameterObject = boundSql.getParameterObject();
  KeyGenerator keyGenerator = mappedStatement.getKeyGenerator();
  keyGenerator.processAfter(executor, mappedStatement, ps, parameterObject);
  return rows;
}

```

✔ **핵심 요점**

- `ps.execute()`를 호출하여 **SQL 실행**.
- `ps.getUpdateCount();`를 사용해 **변경된 행 수를 반환**.

#### Update의 최종 코드

```java
@Override
public int update(Statement statement) throws SQLException {
  PreparedStatement ps = (PreparedStatement) statement;
  ps.execute();
  int rows = ps.getUpdateCount();
  Object parameterObject = boundSql.getParameterObject();
  KeyGenerator keyGenerator = mappedStatement.getKeyGenerator();
  keyGenerator.processAfter(executor, mappedStatement, ps, parameterObject);
  return rows;
}
```



## MyBatis가 `int`를 반환하는 이유

이제 이 반환값을 받은 MyBatis의 MapperMethod는 Update의 반환값인 rowCount를 반환하기 위해 다음을 호출합니다. 

여기서 **rowCountResult 메서드는 SQL 실행 결과로 반환된 영향받은 행의 수를 반환 타입에 맞게 변환하는 역할** 을 합니다.

```java
private Object rowCountResult(int rowCount) {
  final Object result;
  if (method.returnsVoid()) {
    result = null;
  } else if (Integer.class.equals(method.getReturnType()) || Integer.TYPE.equals(method.getReturnType())) {
    result = rowCount;
  } else if (Long.class.equals(method.getReturnType()) || Long.TYPE.equals(method.getReturnType())) {
    result = (long) rowCount;
  } else if (Boolean.class.equals(method.getReturnType()) || Boolean.TYPE.equals(method.getReturnType())) {
    result = rowCount > 0;
  } else {
    throw new BindingException(
        "Mapper method '" + command.getName() + "' has an unsupported return type: " + method.getReturnType());
  }
  return result;
}

```

이제 클라이언트는 Update 쿼리에 대한 결과인 Int타입의 rowCount결과를 받게 되었습니다.

그렇다면 왜 이렇게 설계했을까요?
Integer 반환값은 매우 유용한데, 다음과 같은 이유가 있습니다:

1. **쿼리가 성공적으로 실행되었는지 확인** 할 수 있습니다 (0보다 큰 값이면 최소 하나의 행이 변경됨)
2. **정확히 몇 개의 행이 영향을 받았는지** 알 수 있습니다
3. **조건에 맞는 행이 없어 업데이트가 실패했는지 확인** 할 수 있습니다 (0이 반환되면 조건에 맞는 행이 없었음)

이러한 정보는 데이터 무결성을 확인하거나 추가 로직을 실행할지 결정하는 데 중요한 역할을 합니다.



## **왜 동적 프록시를 사용하는가?**

MyBatis는 **동적 프록시(Dynamic Proxy)** 를 사용하여 **인터페이스 기반으로 SQL 실행을 가능하게 합니다**.

✔ **정적 프록시를 사용하지 않는 이유**

- **정적 프록시를 사용하면 매번 새로운 프록시 클래스를 만들어야 하므로 유지보수가 어려움**.
- SQL이 100개, 200개 늘어나면 **모든 DAO마다 개별 프록시 객체를 만들어야 함 → 코드가 비대해짐**.

✔ **동적 프록시의 장점**

1. 런타임에 유연한 SQL 실행
   - 인터페이스만 정의하면 **MyBatis가 동적으로 구현체를 생성**.
2. 반복적인 코드 감소
   - `JDBC` 코드를 직접 작성할 필요 없이 **인터페이스 기반으로 SQL 실행 가능**.
3. SQL과 Java 코드의 관심사 분리
   - SQL 변경 시 **자바 코드를 수정할 필요 없음**.
4. 대규모 프로젝트에서 유지보수성 향상
   - **SQL 변경이 잦은 환경에서도 유연하게 대응 가능**.



## **결론**

✅ **MyBatis는 `MapperProxy`를 통해 인터페이스 기반으로 SQL을 실행할 수 있도록 동적 프록시를 생성**

✅ **`invoke()` → `execute()` → `update()` → `StatementHandler.executeUpdate()` 순으로 SQL 실행**

✅ **JDBC의 `executeUpdate()`가 변경된 행 수를 반환하기 때문에 `int` 타입을 반환**

✅ **동적 프록시는 코드 중복을 줄이고 유지보수를 쉽게 만들어 줌**

👉 **즉, MyBatis는 동적 프록시를 활용하여 SQL 실행을 더욱 유연하게 처리하는 강력한 프레임워크입니다!**



> 해당 내용은 유레카 sw 교육 보조강사님의 설명을 참고하여 작성한 글입니다.
