---
layout: post
title: "일급 컬렉션"
tag: [Java, Interview]
description: 일급 컬렉션이 무엇인가요?
image: '/images/2025-03-20-first_class_collection/first_class_collection.png'
tags_color: '#3eb99a'
---

# 일급 컬렉션이 무엇인가요?

일급 컬렉션(First-Class Collection)은 하나의 컬렉션을 감싸는 클래스를 만들고, 해당 클래스에서 컬렉션과 관련된 비즈니스 로직을 관리하는 패턴을 말합니다. 

아래 코드 중에서 Order의 List 자료구조를 감싼 Orders가 일급 컬렉션의 예시입니다.

```java
// 일급 컬렉션
public class Orders {

    private final List<Order> orders;

    public Orders(List<Order> orders) {
        validate(orders); // 검증 수행
        ...
    }

    public void add(Order order) {
        if (order == null) {
            throw new IllegalArgumentException("Order cannot be null");
        }
        orders.add(order);
    }

    public List<Order> getAll() {
        return Collections.unmodifiableList(orders); // 외부에서 변경 불가능하게 반환
    }

    public double getTotalAmount() {
        return orders.stream()
                     .mapToDouble(Order::getAmount)
                     .sum();
    }
}
```

```java
public class OrderService {
  
    private final Orders orders = new Orders();

    public void addOrder(Order order) {
        orders.add(order);
    }

    public Orders getOrders() {
        return orders;
    }

    // 추가 비즈니스 로직...
}
```

✅ **일급 컬렉션 (First-Class Collection)**

✔ `List<Order>` 같은 컬렉션을 클래스로 감싸서 **객체 지향적인 설계**를 함

✔ **비즈니스 로직을 컬렉션 내부에서 캡슐화**

✔ 컬렉션을 외부에서 직접 조작하지 못하게 함 (불변성 유지)

✔ 주로 **도메인 모델(VO, 엔티티) 내부에서 활용**됨

## **"일급 컬렉션의 필수 조건"**

1️⃣ **컬렉션을 클래스 내부에 감싸야 함** ( `List<Order>` → `Orders`)

2️⃣ **컬렉션을 직접 노출하지 않고, 불필요한 조작을 막아야 함** ( `Collections.unmodifiableList(orders)`)

3️⃣ **비즈니스 로직을 포함해야 함** ( `getTotalAmount()`, `validate()`)

4️⃣ **불변성을 유지할 수 있어야 함** ( `private final List<Order> orders`)



💡 **"단순한 리스트 래핑이 아니라, 컬렉션을 직접 조작하지 못하도록 보호하는 구조가 있어야 하며 컬렉션과 관련된 비즈니스 로직을 담아야 진짜 일급 컬렉션이다!"**



# 일급 컬렉션을 사용해야하는 이유는 무엇인가요? 😀

일급 컬렉션 클래스에 로직을 포함하거나 비즈니스에 특화된 명확한 이름을 부여할 수 있습니다. 또한, 불필요한 컬렉션 API를 외부로 노출하지 않도록 할 수 있으며, 컬렉션을 변경할 수 없도록 만든다면 예기치 않은 변경으로부터 데이터를 보호할 수 있습니다.
