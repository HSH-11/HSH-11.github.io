---
layout: post
title: BRAIVIO — 서로 다른 생각을 엮어, 하나의 결정을 만들다.
description: Canvas-first 설계 · 실시간 협업 · Research→Vote→Decision
image: '/images/'
tags: [Project]
tags_color: '#de47e2'
featured: true
toc: true
---

### 프로젝트 소개

**BRAIVIO**는 여러 사람이 하나의 캔버스에서 생각과 조사 자료를 시각적으로 정리하고, 후보를 비교·투표한 뒤 최종 결정을 기록하는 **협업형 의사결정 캔버스**입니다.

FigJam 같은 협업 보드의 직관적인 작업 감은 참고하되, 범용 화이트보드를 복제하는 것이 목표는 아닙니다.  
BRAIVIO의 중심은 **근거(Source/Evidence) → 후보(Candidate) → 투표(Vote) → 결정(Decision)** 이 한 보드 안에서 끊기지 않고 이어지는 경험입니다.

| 구분 | 내용 |
|------|------|
| 제품 방향 | Canvas-first 의사결정 보드 |
| Backend | Java 21 · Spring Boot 4 · Spring Security · JPA · Flyway · WebSocket/STOMP · MySQL |
| Frontend | React 19 · TypeScript · Vite · React Flow · TanStack Query · STOMP |
| 협업 모델 | REST가 영속 원본, WebSocket은 커밋 이벤트·Presence 전달 |
| 동시성 | 객체 version + 비관적 락 → 충돌 시 409 후 Snapshot 재동기 |

**현재 제품 구조**

| 영역 | 현재 방식 |
|------|-----------|
| 제품 중심 | 공유 캔버스 기반 의사결정 |
| 기본 작업 화면 | 중앙 무한 캔버스 + Inspector |
| 자료·후보 | Source / Evidence / Candidate Card |
| 협업 | 객체 동기화 · 커서 · 댓글 · 리액션 · 투표 · Meeting |
| 결정 | Vote Card / Decision Card |
| 데이터 | 도메인 데이터 + board_objects 표현 계층 |

**핵심 사용자 흐름**

Workspace 생성 → Sticky / Text로 아이디어 정리 → Source · Evidence · Candidate Card 배치 → Evidence ↔ Candidate 관계 연결 → 실시간 협업 · 댓글 · 리액션 → Vote Session → Decision 확정 (Snapshot 보존)

------

### 기술 스택과 아키텍처 원칙

기능별 목록 화면으로 조사·투표·결정을 나누면 맥락이 끊기기 쉽습니다. BRAIVIO는 처음부터 **한 캔버스에서 조사부터 결정까지** 이어지도록 경계를 잡았습니다.

**Backend (BRAIVIO-backend)**

- Modular Monolith: identity / workspace / board / source / evidence / option / voting / decision / comment / reaction / realtime / playlist
- 각 도메인은 presentation → application → domain (+ infrastructure) 경계를 유지
- Flyway로 스키마 버전 관리, Testcontainers 기반 통합 테스트

**Frontend (BRAIVIO-frontend)**

- React Flow로 좌표계·노드·엣지 렌더링
- 서버 목록·세션은 TanStack Query, 보드 본문은 전용 컨트롤러 훅이 소유
- Zustand 없이 Auth Context + Board Context + 로컬 UI state로 구성

**설계에서 끝까지 지킨 원칙**

1. **Canvas is Presentation** — 카드의 위치·크기와 업무 데이터(Source/Evidence/Option 등)를 분리한다.
2. **REST is Source of Truth** — DB 반영은 REST Application Service가 수행한다. WebSocket은 알림과 임시 상태만 전달한다.
3. **Commit Before Broadcast** — 영속 이벤트는 DB 커밋 후에만 브로드캐스트한다.
4. **Server-authoritative** — 권한·버전·투표 규칙은 서버가 최종 결정한다.
5. **No CRDT/OT** — 문자 단위 병합 대신 객체 version 충돌을 감지하고 Snapshot으로 복구한다.
6. **Viewport는 개인 것** — 확대/축소/스크롤 위치는 서버에 공유하지 않는다. Spotlight처럼 “같이 보자”가 필요할 때만 예외적으로 뷰를 맞춘다.

```text
[React SPA]
   │  REST  (/api/v1/...)  + Session Cookie + CSRF
   │  STOMP (/ws)          + 동일 세션 + CSRF
   ▼
Application Services  ──권한 검증──► Workspace Membership
   │  TX 내 WorkspaceEvent 발행
   ▼
MySQL (Flyway)                 Realtime
 durable state  ──커밋 후──►  board 토픽
                ──휘발───►  presence 토픽  (커서·드래그·회의)
```

------

### 인증 · Workspace · 권한

**세션 + CSRF를 선택한 이유**

브라우저 SPA와 쿠키 기반 협업 보드라는 전제에서, 토큰을 JS에 두지 않는 **HttpOnly 세션 쿠키 + CSRF** 조합을 먼저 고정했습니다.  
WebSocket CONNECT에도 동일 CSRF를 검증해 REST와 실시간 채널의 인증 경로를 맞췄습니다.  
(Kakao/Google OAuth용 identity 스키마는 준비만 하고, MVP에서는 로컬 이메일 가입·로그인만 구현)

**Workspace 권한 모델**

| 역할 | 캔버스 편집 | 댓글/리액션 | 투표 | 투표 관리 | Decision 확정 | 멤버 관리 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| OWNER | O | O | O | O | O | O |
| EDITOR | O | O | O | 생성/종료 | X | X |
| VIEWER | X | 정책 | 정책 | X | X | X |

- MVP Workspace visibility는 **PRIVATE만** 허용
- 초대 토큰은 **원문을 1회만 보여주고 DB에는 SHA-256 해시**만 저장
- 멤버 제거 시 이벤트를 발행해 해당 사용자의 WebSocket 세션을 강제 종료

프론트는 역할에 따라 툴바·액션을 먼저 숨기고, 서버 Application Service가 WorkspacePermission으로 다시 검증하는 이중 구조입니다.

------

### 보드 데이터 모델 — Presentation과 Domain 분리

가장 중요한 설계 결정은 **캔버스 객체와 업무 데이터를 같은 테이블에 섞지 않은 것**입니다.

- **board_objects**: 위치, 크기, z-index, 색상, 객체 타입, Section 소속, soft delete
- **Source / Evidence / Option / VoteSession / Decision**: 정규화된 업무 엔티티
- 카드형 객체는 해당 엔티티를 **참조(FK)** 하고, 타입별 참조 XOR 제약으로 잘못된 연결을 막음

이 분리 덕분에:

- 카드 삭제 ≠ 원본 조사 데이터 삭제 (소프트 삭제 후 재배치 시 restore)
- 도메인 데이터가 바뀌면 REFERENCE_UPDATED로 보드 카드 요약만 갱신
- 나중에 목록형 UI를 다시 붙이더라도 도메인 API를 재사용할 수 있음

지원 객체:

| 객체 | 역할 |
|------|------|
| Sticky Note / Text | 자유 메모·제목 |
| Source Card | URL과 공개 메타데이터 |
| Evidence Card | 발췌·사실·관찰·메모 |
| Candidate Card | 의사결정 후보(내부 도메인 Option) |
| Vote / Decision Card | 투표 세션 · 최종 결정 |
| Section | 관련 객체를 묶는 영역 |
| Shape + Connector | 기본 도형 · 시각적 연결선 |

Section은 중첩을 금지하고, Section 삭제 시 자식 객체는 해제만 합니다.  
Connector(직선/엘보)는 **시각적 연결**이며, Evidence↔Candidate의 SUPPORTS/CONCERNS/CONTEXT **도메인 관계와는 별개**로 유지했습니다.

------

### 조사 파이프라인 — Source → Evidence → Candidate

의사결정 보드답게, 조사 흐름을 카드 UX로 묶었습니다.

1. **Source 등록**  
   URL 정규화 + url_hash로 Workspace 내 중복을 막고, SSRF 차단 정책을 적용합니다.  
   등록 직후 응답을 빠르게 돌려주고, 메타데이터(title/OG/favicon)는 **커밋 후 비동기 fetch**로 채웁니다.

2. **Evidence 작성**  
   QUOTE / FACT / NOTE / OBSERVATION 유형으로 근거를 남기고, 필요하면 Source에서 발췌해 생성합니다.

3. **Candidate와 관계 연결**  
   Evidence가 후보를 **지지(SUPPORTS) / 우려(CONCERNS) / 맥락(CONTEXT)** 하는지 연결합니다.  
   카드 UI에는 지지·우려 카운트가 바로 보이도록 설계했습니다.

프론트에서는 Link / Evidence / Candidate 도구가 Dialog → 카드 배치로 이어지고, 캔버스에 URL을 붙여넣으면 Source Dialog가 열리도록 해 조사 진입 마찰을 줄였습니다.

------

### 투표와 Decision Snapshot

투표·결정은 “회의에서 말로만 정하고 기록이 사라지는” 문제를 겨냥한 기능입니다.

**Vote Session**

- 상태: **DRAFT → OPEN → CLOSED** (재개 없음)
- MVP는 **단일 선택 + 종료 후 결과 공개**
- 진행 중에는 타인 선택/집계를 숨기고, 본인 표만 노출
- 후보 변경 허용 여부는 세션 옵션으로 제어

**Decision**

- OWNER만 finalize 가능
- 확정 순간 후보·투표 요약·관련 Evidence를 **snapshot_json으로 고정**
- 이후 수정 불가 — “그때 왜 그렇게 결정했는지”를 보드 안에 남김

즉, 투표는 **실시간 선호 수집**, Decision은 **불변 기록**으로 역할을 나눴습니다.

------

### 실시간 협업 — Durable vs Volatile

실시간 계층을 한 채널에 섞지 않고, 성격이 다른 두 갈래로 나눴습니다.

| 구분 | 예시 | 저장 | 전달 |
|------|------|------|------|
| **Durable** | 객체 CRUD, 연결선, 댓글, 리액션, 플레이리스트 | MySQL | REST 커밋 후 board 토픽 |
| **Volatile** | Presence, 커서, 드래그 프리뷰, 회의 타이머/Spotlight | 인메모리 | presence 토픽 |

**왜 이렇게 나눴는가**

- 드래그 중 좌표를 매번 DB에 쓰면 부하와 충돌이 커집니다.  
  → 드래그는 Preview만 보내고, **손 뗄 때 REST로 최종 좌표 저장**
- WebSocket이 끊겨도 REST로 조회·수정이 가능해야 합니다.  
  → 재접속 시 Board Snapshot으로 복구
- MVP는 **단일 서버 Simple Broker**. Redis Pub/Sub 다중 인스턴스 확장은 P1로 남겨 두었습니다.

**Presence · 커서 · 드래그**

| 기능 | 설계 |
|------|------|
| Presence | 주기적 Ping + stale 만료. JOIN/LEFT 시 참여자 목록 동기화. 다중 탭은 sessionId로 구분 |
| 커서 | 월드 좌표 + 선택 객체 ID. 줌과 무관하게 보이도록 화면 스케일을 보정 |
| 드래그 Ghost | 이동 중에는 반투명 미리보기만 브로드캐스트. 최종 위치는 REST 1회로 확정 |
| Rate limit | 클라이언트 throttle + 서버 세션당 상한. 초과 프레임은 조용히 drop |

프론트는 접속자 아바타, 원격 커서, 선택 하이라이트, Follow(아바타 클릭으로 시선 추적), 연결 상태 배너(connected / reconnecting / offline)를 제공합니다.

------

### Meeting 타이머와 Spotlight

의사결정 보드에서는 “지금 이 카드를 같이 보자”, “3분만 이야기하자” 같은 **짧은 진행 보조**가 필요합니다.  
음성·영상 통화 없이, 캔버스 시선과 시간만 맞추는 쪽으로 범위를 잡았습니다.

**Meeting 타이머**

- 상태: 시작 → 일시정지 → 재개 → 종료
- 서버는 **남은 ms만** 뿌리지 않고 **절대 종료 시각(endsAt)** 을 브로드캐스트
- 클라이언트는 로컬 틱으로 카운트다운 → 기기 간 시계 오차를 줄이는 방식
- DB/Snapshot에 넣지 않는 **휘발 상태**. 서버 재시작 시 타이머는 사라짐
- 편집 권한이 있는 멤버만 제어, VIEWER는 조회만

**Spotlight — “지금 여기를 보라”**

Spotlight는 진행자가 선택 객체(또는 좌표)를 선언하면, 다른 참여자 뷰포트가 그 지점으로 부드럽게 따라가는 **시선 공유** 기능입니다.

| 항목 | 설계 |
|------|------|
| 선점 | 비어 있거나 본인 점유일 때 EDITOR가 ON |
| 충돌 | 타인이 이미 켜 두면 BUSY. OWNER만 force로 인수(확인 UI) |
| 해제 | 본인 또는 OWNER |
| 팔로워 | 진행자 선택/좌표로 뷰 센터 이동, 대상 카드 하이라이트 |
| 우선순위 | 아바타 Follow가 켜져 있으면 Spotlight보다 Follow 우선. 수동 팬/Esc로 Follow 해제 |
| 세션 | sessionId 단위로 소유. 강제 인수 후 구 세션의 UPDATE는 무시 |

초기에는 커서 Follow만으로도 충분하다고 봤지만, 회의 중 “진행자가 가리키는 카드”를 전원에게 고정하려면 **서버가 단일 진행자를 소유하는 상태**가 필요했습니다.  
그래서 Presence와 같은 휘발 채널 위에 MeetingStateRegistry를 두고, 타이머·Spotlight를 한 스냅샷으로 재입장자에게만(활동 중일 때) 다시 밀어 주도록 만들었습니다.

------

### 동시 편집과 자동 저장 UX

동시 편집에서 “조용한 덮어쓰기”를 막는 것이 목표였습니다.

**서버**

- Board Object(및 Evidence/Option/Vote/Decision)에 애플리케이션 version 유지
- 변경 전 비관적 락으로 잠근 뒤 version 비교
- 불일치 시 **409 VERSION_CONFLICT** (+ latestVersion)

**클라이언트**

- 편집·이동·리사이즈는 **낙관적 로컬 반영**
- 쓰기는 **직렬 큐**로 보내 자기 자신과의 버전 꼬임을 방지
- 하단 상태: 저장됨 / 저장 중 / 저장 실패(재시도)
- 충돌 시 토스트 + Snapshot 재동기화, 텍스트 충돌은 로컬 내용을 복사할 수 있는 notice 제공

CRDT를 쓰지 않은 대신, **충돌을 명시적으로 드러내고 최신 서버 상태로 수렴**하는 정책을 택했습니다.  
소규모 그룹 의사결정 보드에서는 이 단순함이 구현·운영 비용을 크게 줄여 줍니다.

------

### 캔버스 UX — React Flow 위에 의사결정 도구를 얹기

프론트 캔버스는 React Flow를 좌표계·인터랙션 기반으로 쓰고, 그 위에 BRAIVIO 전용 카드·Inspector·도구를 올렸습니다.

- **Pan/Zoom**: Hand 도구, 중간/우클릭 드래그, 핀치, 하단 줌 바(25%~200%)
- **도구 팔레트**: Select / Sticky / Text / Section / Shape / Connector / Source / Evidence / Candidate / Vote / Decision
- **Inspector**: Details · Relationships · Comments 탭으로 선택 객체의 도메인 편집과 협업을 한쪽에 고정
- **단축키·온보딩 CTA**로 빈 보드 진입 장벽을 낮춤

카드는 공통 ObjectFrame으로 선택·리사이즈·원격 선택 표시·연결 핸들·engagement 뱃지를 통일하고, 타입별 본문만 다르게 렌더링합니다.

상태 소유권도 명확히 나눴습니다.

| 계층 | 담당 |
|------|------|
| 인증·Workspace 목록 | TanStack Query + Auth Context |
| 보드 객체/저장 큐 | Board Controller |
| 실시간 Presence/Meeting | Realtime / Meeting 훅 |
| 도구·Dialog·Inspector | 페이지 로컬 state |
| 핀(즐겨찾기) | localStorage only |

보드 Snapshot은 진입 시 한 번 받은 뒤, 목록 Query refetch로 덮지 않습니다.  
이후에는 **로컬 낙관 상태 + 실시간 이벤트**가 보드의 주인이 됩니다.

------

### 부가 협업 기능

**객체 댓글 · 리액션**  
일반 채팅이 아니라 **특정 카드에 붙는 스레드**로 설계했습니다.  
답글, OWNER 삭제, Viewer 댓글/투표 허용 정책, 이모지 리액션(멱등 PUT/DELETE)을 지원합니다.

**공유 플레이리스트**  
회의 분위기를 위한 YouTube 트랙 목록을 Workspace 단위로 공유합니다.  
목록만 서버가 동기화하고, **재생 위치는 기기 로컬**로 두어 “누가 재생 중인지” 동기화 복잡도까지는 범위에 넣지 않았습니다.

------

### 트러블슈팅

구현 과정에서 특히 실시간·권한 경계에서 몇 가지를 반복해서 다듬었습니다.

**1) WebSocket에도 CSRF를 맞춰야 했다**  
REST는 쿠키 CSRF로 막아 두었는데, STOMP CONNECT를 열어 두면 실시간 채널만 우회 경로가 됩니다.  
핸드셰이크에서 세션을 읽고, CONNECT 시점에 XSRF 헤더를 다시 검증하도록 맞춰 REST와 WS의 인증 모델을 통일했습니다.

**2) 멤버 강퇴 직후 재연결 루프**  
소켓을 먼저 끊으면 MEMBER_REMOVED 이벤트를 클라이언트가 못 받고, 끊김만 보고 자동 재연결을 시도했습니다.  
**이벤트 브로드캐스트 → 짧은 지연 → 강제 Close** 순서로 바꾸고, 클라는 강퇴 수신 시 재연결을 끄도록 수정했습니다.

**3) 드래그 중 REST 폭주**  
이동 좌표를 실시간으로 저장하면 요청 수와 version 충돌이 동시에 늘어났습니다.  
**이동 중에는 Ghost(휘발)만, 손 뗄 때 REST 1번**으로 고정해 부하와 충돌을 함께 줄였습니다.

**4) Spotlight 이중 선점**  
두 EDITOR가 거의 동시에 ON을 누르면 진행자가 둘로 갈라질 수 있습니다.  
서버 단일 레지스트리로 직렬화하고, 점유 중이면 BUSY를 돌려 OWNER force만 인수 가능하게 했습니다.  
같은 멤버의 탭 재연결은 busy가 나지 않도록 “본인 재개”를 허용했습니다.

**5) 버전 충돌과 실시간 이벤트가 겹칠 때**  
내가 REST로 저장하는 동안 다른 사람의 durable 이벤트가 들어오면, 낙관적 로컬 상태와 서버 버전이 어긋납니다.  
직렬 쓰기 큐 + 409 시 Snapshot 재조회로 수렴시키고, 텍스트 편집 중 충돌은 입력 내용을 잃지 않도록 복사 가능한 notice를 남겼습니다.

------

### 구현 범위와 의도적으로 남긴 것

**현재 구현된 MVP 축**

- 이메일 인증, Workspace/초대/역할
- 무한 캔버스 + 주요 객체 + Shape/Connector
- Source 메타 fetch, Evidence–Candidate 관계
- 댓글·리액션, Vote, Decision Snapshot
- STOMP Presence/커서/드래그/Meeting(타이머·Spotlight)
- 낙관적 자동저장 + version 충돌 복구
- 공유 플레이리스트

**의식적으로 미룬 것 (P1 / Out of scope)**

- Redis 기반 다중 서버 Presence/Pub-Sub
- Kakao/Google OAuth 로그인
- 비교 테이블, 다중 선택 그룹, 템플릿, 활동 이력
- CRDT/OT, 자유 드로잉, WebRTC 통화, AI 요약, 공동 브라우징

범위를 줄인 이유는 단순합니다.  
**조사 자료와 후보가 한 캔버스에서 결정으로 끝나는가**를 먼저 검증하기 위해서입니다.

------

### 정리 — 이 프로젝트에서 보여 주고 싶은 것

BRAIVIO 개발에서 중요하게 본 것은 라이브러리 사용 여부보다 **경계를 어디에 둘지**였습니다.

- 제품 경계를 Canvas-first 의사결정으로 고정하고
- 데이터 경계를 Presentation(board_objects)과 Domain(Research/Vote/Decision)으로 나누고
- 통신 경계를 REST(영속)과 WebSocket(이벤트/Presence/Meeting)으로 나누고
- 동시성 경계를 version 충돌 + Snapshot 복구로 단순화했습니다.

그 결과, 프론트는 카드와 협업 UX에 집중하고, 백엔드는 권한·규칙·영속·브로드캐스트에 집중하는 구조가 되었습니다.

다음 단계로는 OAuth 로그인, Redis 기반 수평 확장, 비교 테이블 같은 P1 기능을 제품 검증 결과에 맞춰 확장할 예정입니다.
