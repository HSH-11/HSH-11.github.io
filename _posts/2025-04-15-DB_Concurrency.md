---
layout: post
title:  "데이터베이스 시스템 동시성 제어"
tag: [DataBase, Interview]
description: DB 동시성 제어 방법
image: '/images/2025-04-15-DB_Concurrency/main.jpg'
tags_color: '#aa1eaa'
---


# 데이터베이스 시스템에서 동시성을 제어하는 방법에 대해 설명해주세요.

대표적인 동시성 제어 방식으로 **MVCC(Multi-Version Concurrency Control)** 와 **Lock-Based Concurrency Control**이 있습니다.

## MVCC(Multi-Version Concurrency Control)

MVCC는 데이터의 여러 버전을 유지하여 트랜잭션이 동시에 데이터를 읽고 쓸 수 있도록 하는 방식입니다. 각 트랜잭션은 자신만의 **일관된 스냅샷**을 기반으로 데이터를 읽어, 다른 트랜잭션의 변경 사항에 영향을 받지 않습니다.

데이터의 각 버전을 유지하여 읽기 작업이 쓰기 작업과 독립적으로 이루어질 수 있습니다. 트랜잭션은 시작 시점의 스냅샷을 기반으로 데이터를 읽어, 다른 트랜잭션의 변경 사항을 보지 못합니다.

또한 **읽기 작업 시 잠금을 사용하지 않아 높은 동시성**을 제공합니다. 읽기 작업이 잠금에 의해 지연되지 않아, 읽기 중심의 애플리케이션에서 우수한 성능을 보입니다. 읽기 작업 시 잠금을 사용하지 않으므로, 쓰기 작업과의 충돌이 줄어듭니다. 하지만 여러 버전의 데이터를 유지해야 하므로 저장 공간이 더 많이 필요할 수 있습니다.

트랜잭션이 시작된 시점의 데이터 상태를 기반으로 읽기 작업을 수행하여 일관성을 유지합니다. 또 갭락과 넥스트키 락을 통해 팬텀 리드를 방지합니다.

## Lock-Based Concurrency Control

Lock-Based 방식은 데이터에 접근할 때 **잠금(Lock)** 을 사용하여 동시성을 제어합니다. 트랜잭션이 데이터를 읽거나 수정할 때 해당 데이터에 잠금을 걸어 다른 트랜잭션의 접근을 제한합니다. 즉, 잠금을 통해 데이터의 일관성과 무결성을 직접적으로 제어합니다.

데이터에 접근할 때 잠금을 걸어 다른 트랜잭션의 접근을 제한합니다. **읽기 작업은 공유 잠금**을, **쓰기 작업은 배타 잠금**을 사용하여 동시성을 제어합니다. 많은 다수의 트랜잭션이 동일한 데이터에 접근할 경우 성능 저하가 발생할 수 있습니다. 또 잘못된 잠금 순서나 설계로 인해 교착 상태(Deadlock)가 발생할 위험이 있습니다.

## MVCC와 Lock-Based Concurrency Control 둘 중 어떤 걸 사용해야 하나요? 🤔

실제 데이터베이스 시스템, 특히 MySQL의 InnoDB는 MVCC와 Lock-Based 방식의 장점을 결합하여 동시성 제어를 최적화합니다.

**읽기 트랜잭션은 MVCC를 사용**하여 일관된 스냅샷을 기반으로 데이터를 읽으므로, **잠금을 최소화**하고 **높은 동시성**을 유지할 수 있습니다.

**쓰기 트랜잭션은 잠금을 사용**하여 **데이터의 일관성과 무결성을 유지**하면서, 동시에 **데이터 충돌을 방지**합니다.

## MySQL InnoDB에서 갭락과 넥스트키 락이란 무엇이며, 어떻게 팬텀 리드를 방지하나요?

### Phantom Read란 무엇인가요?

Phantom Read는 트랜잭션이 동일한 조건의 쿼리를 반복 실행할 때, 나중에 실행된 쿼리에서 처음에는 존재하지 않았던 새로운 행이 나타나는 현상을 말합니다. 이는 주로 **읽기 일관성(Read Consistency)** 을 유지하는 과정에서 발생할 수 있는 문제로, 데이터의 삽입이나 삭제가 다른 트랜잭션에 의해 이루어질 때 발생합니다.

```java
-- 트랜잭션 A 시작
START TRANSACTION;

-- 트랜잭션 A 첫 번째 조회
SELECT * FROM orders WHERE amount > 150;

-- 트랜잭션 B 시작
START TRANSACTION;

-- 트랜잭션 B 새로운 행 삽입
INSERT INTO orders (customer_id, amount) VALUES (4, 250);

-- 트랜잭션 B 커밋
COMMIT;

-- 동일한 조건으로 트랜잭션 A 두 번째 조회시, 트랜잭션 A의 첫 번째 조회에는 존재하지 않던, 트랜잭션 B에서 삽입된 새로운 행이 함께 조회된다.
-- 단, MVCC를 지원하는 경우 해당 케이스에서 팬텀 리드가 발생하지 않는다.
SELECT * FROM orders WHERE amount > 150;
```

### 갭락(Gap Lock)이란?

갭 락은 특정 인덱스 값 사이의 **공간**을 잠그는 락입니다. 기존 레코드 간의 간격을 보호하여 새로운 레코드의 삽입을 방지합니다. 갭 락은 **범위 내에 특정 레코드가 존재하지 않을 때** 적용됩니다. 트랜잭션이 특정 범위 내에서 데이터의 삽입을 막아 **팬텀 읽기(Phantom Read)** 현상을 방지합니다. 예를 들어, 인덱스 값 10과 20 사이의 갭을 잠그면 이 범위 내에 새로운 레코드 15를 추가할 수 없습니다.

```java
-- id 1, 3, 5가 저장된 orders 테이블

-- 트랜잭션 A 시작
START TRANSACTION;

-- 트랜잭션 A 1-3과 3-5 사이의 갭과 3 레코드 락 설정(넥스트키 락)
SELECT * FROM orders WHERE orders_id BETWEEN 2 AND 4 FOR UPDATE;

-- 트랜잭션 B 시작
START TRANSACTION;

-- 트랜잭션 B가 id 4에 데이터 삽입 시도 시, 갭락으로 인해 삽입이 차단되어 대기
INSERT INTO orders (orders_id, orders_amount) VALUES (4, 200);
```

### 넥스트키 락(Next-Key Lock)이란?

**넥스트키 락**은 **레코드 락**과 **갭락**을 결합한 형태로, 특정 인덱스 레코드와 그 주변의 갭을 동시에 잠그는 락입니다. 이를 통해 레코드 자체의 변경과 함께 그 주변 공간의 변경도 동시에 제어할 수 있습니다.

넥스트키 락은 특정 레코드와 그 주변 공간을 잠그기 때문에, 다른 트랜잭션이 새로운 레코드를 삽입하여 팬텀 리드를 발생시키는 것을 방지합니다.

| orders_id | orders_amount |
| :-------: | :-----------: |
|     1     |      100      |
|     2     |      200      |
|     3     |      300      |

```java
-- 트랜잭션 A 시작
START TRANSACTION;

-- 트랜잭션 A amount = 200인 orders_id = 2 레코드에 대한 레코드 락과 1-2, 2-3에 대한 갭락을 동시에 잠금으로써 넥스트키 락을 설정
SELECT * FROM orders WHERE orders_amount = 200 FOR UPDATE;

-- 트랜잭션 B 시작
START TRANSACTION;

-- 트랜잭션 B orders_id = 4, orders_amount = 200인 레코드 삽입 시도 시, 넥스트키 락으로 인해 차단되어 대기
INSERT INTO orders (orders_id, order_amount) VALUES (4, 200);
...
```

### 갭락과 넥스트키 락을 통한 팬텀 리드 방지 메커니즘

**트랜잭션 A**가 특정 범위의 데이터를 조회할 때, 해당 범위에 대해 갭락 또는 넥스트키 락을 설정합니다. 락이 설정된 범위 내에서는 **트랜잭션 B**가 새로운 레코드를 삽입하거나 기존 레코드를 수정하는 것이 차단됩니다. 따라서, 트랜잭션 A가 다시 동일한 조건으로 조회를 수행하더라도, 트랜잭션 B에 의해 새로운 데이터가 삽입되지 않아 팬텀 리드가 발생하지 않습니다.
