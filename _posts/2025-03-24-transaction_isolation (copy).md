---
layout: post
title:  "트랜잭션 격리수준"
tag: [DataBase, Interview]
description: 트랜잭션 격리수준은 무엇인가요?
image: '/images/2025-03-24-transaction_isolation/main.png'
tags_color: '#3eb99a'
---

# 트랜잭션 격리수준은 무엇인가요?

트랜잭션의 격리 수준은 동시에 여러 트랜잭션이 실행될 때 한 트랜잭션이 다른 트랜잭션의 연산에 영향을 받지 않도록 하는 정도를 말합니다. 

낮은 격리 수준은 동시 처리 능력을 높이지만, 데이터의 일관성 문제를 발생시킬 수 있습니다. 반면, 높은 격리 수준은 데이터의 일관성을 보장하지만, 동시 처리 능력이 떨어질 수 있습니다. 즉, 데이터 정합성과 성능은 트레이드 오프 관계입니다. 트랜잭션 격리 수준은 개발자가 트랜잭션 격리 수준을 설정할 수 있는 기능을 제공하는 기능입니다.

## 트랜잭션 격리 수준은 어떤 것이 있고 각각 어떤 특징이 있나요? 🤔

트랜잭션 격리 수준은 READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ가 존재합니다.

- READ UNCOMMITTED: 커밋이 되지 않은 트랜잭션의 데이터 변경 내용을 다른 트랜잭션이 조회하는 것을 허용합니다. 하지만 해당 격리 수준에서는 Dirty Read, Phantom Read, Non-Repeatable Read 문제가 발생할 수 있습니다.
- READ COMMITED: 커밋이 완료된 트랜잭션의 변경사항만 다른 트랜잭션에서 조회할 수 있도록 허용합니다. 특정 트랜잭션이 이루어지는 동안, 다른 트랜잭션은 해당 데이터에 접근할 수 없습니다. Dirty Read는 발생하지 않지만, Phantom Read, Non-Repeatable Read 문제가 발생할 수 있습니다.
- REPEATABLE READ: 한 트랜잭션에서 특정 레코드를 조회할 때 항상 같은 데이터를 응답하는 것을 보장합니다. 하지만, SERIALIZABLE과 다르게 행이 추가되는 것을 막지는 않습니다. 따라서 Phantom Read 문제가 발생할 수 있습니다.
- SERIALIZABLE: 특정 트랜잭션이 사용중인 테이블의 모든 행을 다른 트랜잭션이 접근할 수 없도록 잠급니다. 가장 높은 데이터 정합성을 가지지만 그 만큼 고립 수준이 높기 때문에 성능이 가장 낮습니다. MySQL의 경우 단순한 SELECT 쿼리가 실행되더라고 데이터베이스 잠금이 걸려 다른 트랜잭션에서 데이터에 접근할 수 없습니다.



## 발생하는 문제를 기준으로 설명을 잘해주셨네요. 그런데 각 문제들은 어떤 문제들인가요?🤓

- **Dirty Read**: 한 트랜잭션이 다른 트랜잭션이 변경 중인 데이터를 읽는 경우 발생합니다.
  - 다른 트랜잭션이 아직 커밋되지 않은 (즉, 롤백할 가능성이 있는) 데이터를 읽어서, **그 데이터가 나중에 롤백될 경우 트랜잭션의 결과가 변경**될 수 있습니다. 이는 데이터의 일관성을 깨뜨릴 수 있습니다.
- **Phantom Read**: 한 트랜잭션이 동일한 쿼리를 두 번 실행했을 때, 두 번의 쿼리 사이에 다른 트랜잭션이 삽입, 갱신,삭제 등의 작업을 수행하여 결과 집합이 달라지는 경우를 말합니다. 이로 인해 한 트랜잭션 내에서 일관성 없는 결과를 가져올 수 있습니다.
- **Non-Repeatable Read**: 같은 트랜잭션 안에서 동일한 쿼리를 실행했을 때, 다른 결과를 얻는 경우를 의미합니다. 예를 들어, 한 트랜잭션이 같은 데이터를 두 번 읽을 때, 첫 번째 읽기와 두 번째 읽기 사이에 다른 트랜잭션이 해당 데이터를 변경했을 경우 발생할 수 있습니다.

### ✅ 비교 정리

| 구분               | Non-Repeatable Read (반복 불가능한 읽기) |          Phantom Read (팬텀 리드)           |
| ------------------ | :--------------------------------------: | :-----------------------------------------: |
| **변화 대상**      |       **기존 행(row)의 값**이 바뀜       |  **행(row) 자체**가 **추가되거나 삭제됨**   |
| **현상**           |   같은 조건으로 읽었는데 **값이 다름**   | 같은 조건으로 읽었는데 **행의 개수가 다름** |
| **예시**           |     이름이 "Alice" → "Bob"으로 바뀜      | 처음엔 없던 주문이 새로 생겨 결과에 포함됨  |
| **방지 격리 수준** |           Repeatable Read 이상           |    Serializable (또는 InnoDB의 갭 잠금)     |
