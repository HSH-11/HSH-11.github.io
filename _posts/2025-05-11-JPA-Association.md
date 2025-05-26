---
layout: post
title: JPA 연관 관계
description: JPA 연관 관계 정리(단방향/양방향, 연관 관계의 주인,일대일,다대일,일대다,다대다)
image: '/images/2025-05-11-JPA-Association/association.jpg'
tags: [JPA,Spring]
tags_color: '#ff4500'
toc: true
---

JPA를 사용하면 객체 지향적인 코드와 데이터베이스 간의 관계를 정의할 때 연관 관계 매핑이 중요합니다.

## 연관 관계 정의 규칙

연관 관계를 정의할 때 다음과 같은 세 가지 기준을 고려해야 합니다.

- **방향**: 단방향, 양방향
- **연관 관계의 주인**: 양방향일 때 연관 관계를 관리하는 주체
- **다중성**: 다대일(N:1), 일대다(1:N), 일대일(1:1), 다대다(N:M)

<br>

### 방향성: 단방향 VS 양방향

#### 데이터베이스 vs 객체 관점

- **데이터베이스**: 테이블 간 연관 관계는 외래키(FK) 하나로 충분히 조인이 가능하므로 방향성 개념 자체가 없습니다.
- **객체**: 객체 간의 연관 관계는 참조 필드를 가지고 있는 객체만 다른 객체를 참조할 수 있으므로 방향성이 있습니다.

데이터베이스 테이블은 외래키 하나로 양 쪽 테이블 조인이 가능하다. 따라서 데이터베이스는 단방향이니 양방향이니 나눌 필요가 없다.

#### 단방향과 양방향의 개념

- **단방향**: 두 객체 간에 한쪽만 상대방 객체를 참조하는 필드가 있습니다.

```java
class Post {
	Board board; // 단방향 참조
}
```
- **양방향**: 두 객체가 서로 상대방 객체를 참조하는 필드를 갖고 있습니다.

```java
class Post {
    Board board;
}

class Board {
    List<Post> posts;
}
```

{: .q-left}

> **중요**: 사실 양방향 관계는 두 개의 단방향 관계가 서로를 참조하는 형태일 뿐, 실제로 JPA는 양방향을 별도의 개념으로 관리하지 않습니다.



{: .important}

**무조건 양방향 관계를 하면 쉽지 않나❓**

예를 들어 `User` 객체가 많은 엔티티와 양방향 관계를 맺는다면 코드가 복잡해지고 유지보수가 어렵습니다.
 따라서 연관 관계는 아래 원칙을 지키는 것이 좋습니다.

- 기본적으로 **단방향**을 사용한다.
- **역방향 탐색이 반드시 필요**할 때만 양방향으로 설정한다.

따라서 양방향으로 할지 단방향으로 할지 반드시 구분해줘야합니다.

구분하기 좋은 기준은 기본적으로 <span style="color:orange"> 단방향 매핑으로 하고 나중에 역방향으로 객체 탐색이 꼭 필요하다고 느낄 때 추가하는 방향</span>으로 기준을 잡으면 됩니다.

### 연관 관계의 주인

두 객체가 양방향 관계를 맺었을 때, 실제로 데이터베이스에 외래키를 관리하는 주체를 **연관 관계의 주인**이라고 합니다.

- **연관 관계의 주인**: 데이터베이스의 외래키를 관리하며, 저장·수정·삭제(CRUD)가 가능합니다.
- **연관 관계의 주인이 아닌 객체**: 외래키를 관리하지 않으며, 오직 조회만 가능합니다.

{: .tip}

TIP: 외래키가 있는 엔티티를 연관 관계의 주인으로 지정합니다.

#### 연관 관계의 주인 설정 예시 (mappedBy 활용)

```java
@Entity
class Post {
    @ManyToOne
    @JoinColumn(name = "board_id")
    private Board board; // 연관 관계의 주인 (FK 존재)
}

@Entity
class Board {
    @OneToMany(mappedBy = "board")
    private List<Post> posts; // 연관 관계의 주인이 아님 (FK 관리 X)
}
```

연관 관계의 주인이 아닌 객체에서  <span style="color:red">`mappedBy` </span>속성을 사용해서 주인을 지정합니다.

#### 왜 연관 관계의 주인을 지정해야 하는가? 🤔

양방향 관계에서는 두 객체 모두 서로 참조를 변경할 수 있어 혼란이 생길 수 있습니다.

예를 들어, 게시글(`Post`)의 소속 게시판(`Board`)을 바꾸는 경우를 생각해 봅시다.

- `Post.setBoard(...)`를 호출할 수도 있고,
- `Board.getPosts().remove()` 등을 호출할 수도 있습니다.

하지만 데이터베이스는 FK가 존재하는 `Post` 테이블에서만 게시판 정보가 변경됩니다.

연관 관계의 주인이 명확히 설정되지 않으면 JPA는 어떤 객체의 변경 사항을 데이터베이스에 반영해야 할지 알 수 없습니다. 그래서 연관 관계의 주인을 명확하게 지정해야 합니다.



#### 연관 관계의 주인만 변경하면 끝인가? 🧐

데이터베이스 관점에서는 연관 관계의 주인만 변경하면 됩니다. (`Right!`)

그러나 **객체 관점**에서는 연관 관계의 주인이 아닌 객체도 상태를 동기화하여 변경해주는 것이 좋습니다. 그래야 두 객체가 항상 일관된 상태를 유지할 수 있기 때문입니다.

```java
// Post 객체에서 Board 변경 (연관 관계 주인)
public void changeBoard(Board newBoard) {
    if (this.board != null) {
        this.board.getPosts().remove(this); // 기존 게시판에서 제거
    }
    this.board = newBoard;
    newBoard.getPosts().add(this); // 새로운 게시판에 추가
}
```

이처럼 양쪽의 참조를 동기화하는 것이 객체지향적으로 바람직한 접근 방법입니다.

## JPA 다중성

> JPA 연관 관계에서 엔티티 간의 관계를 얼마나 많은 엔티티가 서로 연관되는지 나타내는 개념

쉽게 말하면 엔티티 간 연결되는 레코드의 수에 따라 구분됩니다.

### 다대일(N:1, ManyToOne)

- 여러 엔티티가 한 엔티티를 참조할 때 사용됩니다.
- 일반적으로 DB 테이블 설계에서 가장 많이 쓰이는 형태입니다.
- 데이터베이스에선 **외래키**를 가지고 있는 쪽이 **다(N)**가 됩니다.

<br>

예시 상황

- 하나의 게시판(Board)에는 여러 개의 게시글(Post)을 작성할 수 있습니다.
- 하나의 게시글(Post)에는 반드시 하나의 게시판(Board)에만 속할 수 있습니다.

즉, 게시판(Board)과 게시글(Post)의 관계는 다대일(N:1)이 됩니다.

#### 다대일(N:1) - 단방향

단방향이란, 한쪽 엔티티만 상대 엔티티를 참조하는 형태입니다.

이 경우 다(N)쪽에서 일(1)쪽 엔티티를 참조합니다.

🔹 **엔티티 코드**

```java
@Entity
public class Post {
    @Id @GeneratedValue
    @Column(name = "POST_ID")
    private Long id;

    @Column(name = "TITLE")
    private String title;

    // 다(N) 쪽 엔티티에서 @ManyToOne을 사용하여 1쪽(Board)을 참조합니다.
    @ManyToOne
    @JoinColumn(name = "BOARD_ID") // FK 컬럼 지정
    private Board board;

    // getter, setter
}

@Entity
public class Board {
    @Id @GeneratedValue
    private Long id;

    private String title;

    // Board에서는 Post를 참조하지 않습니다 (단방향)
    // getter, setter
}
```

다대일(N:1) 단방향에서는 **다(N)** 쪽 엔티티에만 <span style="color:red">`@ManyToOne`</span>을 설정합니다.

**일(1)** 쪽은 상대 엔티티를 참조하지 않으므로 코드를 간결하게 유지할 수 있습니다

#### 다대일(N:1) - 양방향

양방향이란, 양쪽 엔티티가 서로 참조를 갖는 형태입니다.
 즉, <span style="color:red">`Post → Board` </span>참조가 있고, 역으로 <span style="color:red">`Board → Post` </span>리스트로도 참조할 수 있습니다.

🔹 **엔티티 코드**

```java
@Entity
public class Post {
    @Id @GeneratedValue
    @Column(name = "POST_ID")
    private Long id;

    @Column(name = "TITLE")
    private String title;

    // 연관 관계의 주인 (FK 관리 주체)
    @ManyToOne
    @JoinColumn(name = "BOARD_ID")
    private Board board;

    // getter, setter
}

@Entity
public class Board {
    @Id @GeneratedValue
    private Long id;

    private String title;

    // 일(1) 쪽에서 다(N) 쪽을 참조할 때는 mappedBy 속성을 사용하여
    // 연관 관계의 주인이 아님을 명시해야 합니다.
    @OneToMany(mappedBy = "board")
    private List<Post> posts = new ArrayList<>();

    // getter, setter
}
```

양방향으로 설정하면 **역방향 탐색이 가능합니다.**

이때 **연관 관계의 주인**은 반드시 FK가 존재하는 **다(N)** 쪽(Post)이 됩니다.

**일(1)** 쪽(Board)에서는 `mappedBy` 속성으로 연관 관계의 주인을 지정해야 합니다.

<span style="color:red">mappedBy</span>의 값은 상대 엔티티에서 자신을 참조하는 필드명으로 지정합니다. (여기서는 <span style="color:red">`Post`의 `board` </span>필드)

###  일대다(1:N, OneToMany)

일대다(OneToMany)는 "하나의 엔티티가 여러 개의 엔티티를 참조하는 형태"를 의미합니다.

{: .important}

**잠깐, 다대일과 일대다는 같은 거 아닌가요?**

맞습니다. 하지만 <span style="color:green">**JPA에서 연관 관계의 주인을 어느 쪽으로 지정하는가**</span>에 따라 다대일과 일대다가 구분됩니다.
다대일은 **다(N)** 쪽이 주인, 일대다는 **일(1)** 쪽이 주인이 되는 형태입니다.

#### 일대다(1:N)- 단방향

**일(1)** 쪽 엔티티가 **다(N)** 쪽 엔티티를 참조하고 관리하는 형태입니다.

데이터베이스에서는 항상 **다(N)** 쪽에 외래키(FK)를 가지고 있지만, 객체에서는 **일(1)** 쪽이 관리하게 됩니다.

일(1) 쪽 객체에서 다(N) 쪽 객체를 조작하는 방법입니다.

🔹 **엔티티 예시**

```java
@Entity
public class Post {
    @Id @GeneratedValue
    @Column(name = "POST_ID")
    private Long id;

    private String title;

    // getter, setter
}

@Entity
public class Board {
    @Id @GeneratedValue
    private Long id;

    private String title;

    // 일대다 단방향 관계 (mappedBy 없음)
    @OneToMany
    @JoinColumn(name = "BOARD_ID") // 다(N) 쪽 테이블에 FK 컬럼 지정
    private List<Post> posts = new ArrayList<>();

    // getter, setter
}
```

일대다 단방향에서는 `mappedBy`가 없습니다. (양방향이 아니기 때문)

대신 <span style="color:red">**반드시 `@JoinColumn`을 지정해줘야 합니다.**</span>
 (`@JoinColumn`이 없으면 중간 테이블이 생성됨)

🔹 **실제 사용 예시 및 발생 문제**

```java
Post post = new Post();
post.setTitle("가입인사");
entityManager.persist(post); // Post 저장 (INSERT)

Board board = new Board();
board.setTitle("자유게시판");
board.getPosts().add(post);
entityManager.persist(board); // Board 저장 (INSERT 후 Post UPDATE 발생!)
```

**👀 실행 과정 분석**

1. `Post` 저장: `INSERT INTO POST` (정상)
2. `Board` 저장: `INSERT INTO BOARD` 이후  <span style="color:orange">**추가로 Post 테이블에 `BOARD_ID`를 업데이트하는 UPDATE 쿼리가 발생합니다.**</span>

- 이유는 **일(1)** 쪽 객체(`Board`)에서 **다(N)** 쪽(`Post`)의 FK를 관리하는 구조이기 때문입니다.
- 결과적으로 불필요한 UPDATE 쿼리가 발생하여, 직관적이지 않은 구조가 됩니다.

<br>

Board엔티티는 Board테이블에 매핑되기 때문에 Board테이블에 직접 지정할 수 있으나, Post 테이블의 FK(BOARD_ID)를 저장할 방법이 없기 때문에 조인 및 업데이트 쿼리를 날려야 하는 문제가 있습니다.

**🔹 일대다(1:N) 단방향의 치명적인 문제점 ❌**

- **의도치 않은 추가 쿼리**: Board 저장 시 Post가 수정되는 이상한 현상이 발생합니다.
- 코드 작성자가 의도하지 않은 쿼리가 발생해 혼란을 줄 수 있습니다.
- 성능 이슈가 아주 크지는 않지만, **유지보수성과 직관성**이 크게 떨어집니다.

**⇒ 따라서 실무에서는 일대다 단방향을 권장하지 않습니다!**

#### 일대다(1:N) 양방향 관계는? ❌

- **일대다 양방향 관계는 공식적으로 존재하지 않습니다.**
- 이론상 가능은 하지만 <span style="color:red">`@JoinColumn(updatable=false, insertable=false)` </span>속성을 복잡하게 설정해야 하며, 이 구조는 유지보수가 어렵고 직관적이지 않습니다.
- 차라리 다대일(N:1) 양방향 관계를 사용하는 게 훨씬 명확하고 관리하기 쉽습니다.

=> 🌟 <span style="color:orange">**일대다(1:N) 매핑은 사용하지 말고, 다대일(N:1) 양방향 매핑을 사용하자!**</span>

### 일대일(1:N, OneToOne)

#### 일대일(1:1)의 특징

- **두 테이블 중 어느 쪽에나 외래키(FK)를 둘 수 있습니다.**
- 주 테이블이 FK를 갖거나, 대상 테이블이 FK를 가질 수 있습니다.

예시: `Post ↔ Attach` 에서 `Post`가 FK를 가질 수도 있고 `Attach`가 FK를 가질 수도 있습니다.

#### ⚠️ 중요한 개념 정리

- 주 테이블(Owner Entity): **연관 관계의 주인**으로 FK 관리
- 대상 테이블(Target Entity): FK 관리하지 않음, 연관 관계의 주인이 아님

<br>

#### 일대일(1:1) - 단방향 (주 테이블이 FK 보유)

게시글(`Post`)이 반드시 하나의 첨부파일(`Attach`)만 가질 수 있습니다.
이때 **게시글(주 테이블)**이 FK를 가지는 형태입니다.

🔹 **엔티티 예시 코드**

```java
@Entity
public class Post {
    @Id @GeneratedValue
    @Column(name = "POST_ID")
    private Long id;

    private String title;

    // Post가 Attach의 FK(ATTACH_ID)를 관리
    @OneToOne
    @JoinColumn(name = "ATTACH_ID")
    private Attach attach;

    // getter, setter
}

@Entity
public class Attach {
    @Id @GeneratedValue
    @Column(name = "ATTACH_ID")
    private Long id;

    private String name;

    // getter, setter
}
```

주 테이블인 `Post`가 FK(`ATTACH_ID`)를 가지고 Attach를 참조합니다.

매우 일반적이고 권장되는 형태입니다.

#### 일대일(1:1) - 양방향

단순하게 똑같이 <span style="color:red">@OneToOne </span>설정하고 <span style="color:red">mappedBy</span>설정만 해서 읽기 전용으로 만들어주면 양방향도 간단하게 됩니다.

🔹 **엔티티 예시 코드**

```java
@Entity
public class Post {
    @Id @GeneratedValue
    @Column(name = "POST_ID")
    private Long id;

    private String title;

    @OneToOne
    @JoinColumn(name = "ATTACH_ID")
    private Attach attach;

    // getter, setter
}

@Entity
public class Attach {
    @Id @GeneratedValue
    @Column(name = "ATTACH_ID")
    private Long id;

    private String name;

    @OneToOne(mappedBy = "attach")
    private Post post;

    // getter, setter
}
```

**mappedBy**로 연관 관계 주인이 아님을 명확히 지정해줍니다.

Attach 엔티티에서는 FK를 관리하지 않고 단순히 역방향 탐색만 합니다.

#### 일대일(1:1) 단방향 (대상 테이블이 FK 보유) - ❌ **JPA 미지원**

JPA는 **대상 테이블(Target Entity)에 FK가 존재하는 형태의 일대일 단방향을 지원하지 않습니다.**

즉, **Attach(대상)** 테이블에서 FK를 가지면서, Attach가 단방향으로 Post를 참조하는 형태는 **JPA에서 불가능합니다.**

#### 일대일(1:1) 양방향 (대상 테이블이 FK 보유)

대상 테이블이 FK를 갖는 형태는 **반드시 양방향으로 설정해야 합니다.**

🔹 **엔티티 예시 코드**

```java
@Entity
public class Post {
    @Id @GeneratedValue
    @Column(name = "POST_ID")
    private Long id;

    private String title;

    @OneToOne(mappedBy = "post") // FK를 갖지 않음, 연관 관계 주인 아님
    private Attach attach;

    // getter, setter
}

@Entity
public class Attach {
    @Id @GeneratedValue
    @Column(name = "ATTACH_ID")
    private Long id;

    private String name;

    // 대상 엔티티(Attach)에 FK를 설정
    @OneToOne
    @JoinColumn(name = "POST_ID")
    private Post post; // 연관 관계 주인

    // getter, setter
}
```

실무에서 논란이 있습니다.

주 테이블(Post)이 FK를 갖는 게 좋을지, 대상 테이블(Attach)이 FK를 갖는게 좋을지 생각해야 합니다.

| FK 위치                       | 장점                                                    | 단점                                             |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| 주 테이블(Post)이 FK 보유     | 조회 성능이 좋음 (`Post` 조회 시 Attach 즉시 참조 가능) | 비즈니스가 변경될 경우 테이블 구조 변경이 어려움 |
| 대상 테이블(Attach)이 FK 보유 | 비즈니스 변경에 유연함 (Attach가 다(N)가 될 때 유리)    | Post 조회 시 Attach 조회에 추가 쿼리가 필요      |

#### 🌟 권장하는 방식

보통 **일대일** 관계는 신중히 결정되는 것이므로, 일반적으로는 **주 테이블(Post)에 FK를 두는 것을 권장**합니다.

하지만, 비즈니스적으로 향후 **다(N)** 관계로 확장될 가능성이 높은 경우라면, 처음부터 **대상 테이블(Attach)에 FK를 두는 것이 좋을 수도 있습니다.**

### 다대다(N:N, ManyToMany)

두 엔티티가 서로 **여러 개의 엔티티를 참조할 수 있는 형태**를 의미합니다.

예를 들어, 학생이 여러 강의를 수강할 수 있고, 하나의 강의는 여러 학생이 들을 수 있는 관계가 대표적인 예시입니다.

그러나 **실무에서는 다대다 관계를 직접 사용하는 것을 금지합니다.**

####  **다대다(N:M) 관계의 문제점**

JPA에서 다대다 관계를 직접 사용하면 **중간 테이블**이 자동 생성됩니다.

🔹 **중간 테이블 자동 생성 문제**

- JPA가 자동 생성한 중간 테이블은 오직 두 엔티티의 **외래 키(FK)**만 저장할 수 있습니다.
- **추가적인 정보(예: 수강 신청 날짜, 점수, 상태 등)**를 저장할 수 없기 때문에 실무에서는 부적합합니다.
- 또한 개발자가 모르는 사이에 복잡한 조인 쿼리가 발생할 수 있어 **성능과 유지보수성이 크게 저하됩니다.**

<br>

⚠️ 다대다(N:M) 직접 매핑 예시 (비추천)

```java
@Entity
public class Student {
    @Id @GeneratedValue
    private Long id;

    private String name;

    @ManyToMany
    @JoinTable(name = "student_course",
        joinColumns = @JoinColumn(name = "student_id"),
        inverseJoinColumns = @JoinColumn(name = "course_id"))
    private List<Course> courses = new ArrayList<>();
}

@Entity
public class Course {
    @Id @GeneratedValue
    private Long id;

    private String title;

    @ManyToMany(mappedBy = "courses")
    private List<Student> students = new ArrayList<>();
}
```

이 경우, `student_course`라는 중간 테이블이 자동으로 생성됩니다.

하지만 `student_course`에는 `student_id`와 `course_id` 외에 다른 정보를 추가로 넣을 수 없습니다. (큰 단점)

#### 실무 권장 방법: 연결 엔티티(중간 엔티티)를 활용한 일대다-다대일 구조로 풀기

위와 같은 문제를 해결하기 위해 **중간 테이블을 직접 엔티티로 만들어 관리**합니다.
이 방법이 JPA에서 **가장 권장하는 형태**이며 실무에서 표준적으로 사용하는 방법입니다.

🔹 **엔티티를 직접 만들어 연결 관리 (추천)**

```java
@Entity
public class Student {
    @Id @GeneratedValue
    private Long id;

    private String name;

    @OneToMany(mappedBy = "student")
    private List<StudentCourse> studentCourses = new ArrayList<>();
}

@Entity
public class Course {
    @Id @GeneratedValue
    private Long id;

    private String title;

    @OneToMany(mappedBy = "course")
    private List<StudentCourse> studentCourses = new ArrayList<>();
}

@Entity
public class StudentCourse { // 연결 엔티티
    @Id @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id")
    private Student student;

    @ManyToOne
    @JoinColumn(name = "course_id")
    private Course course;

    // 추가 정보 관리 가능!
    private LocalDate enrolledDate;
    private int score;
}
```

이 방법을 사용하면 중간 테이블(`StudentCourse`)에 필요한 추가 정보를 저장할 수 있습니다.

다대다를 일대다 및 다대일 구조로 풀어냄으로써 JPA 사용 시 더 명확하고 유연하게 연관 관계를 관리할 수 있습니다.

**결론적으로 실무에서는 다대다(N:M) 직접 관계는 절대 사용하지 말고**,
연결 엔티티를 활용한 **일대다(1:N), 다대일(N:1)로 풀어내는 방법**을 선택하는 것이 가장 좋습니다.