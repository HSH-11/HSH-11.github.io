---
layout: post
title: BRAIVIO — 서로 다른 생각을 엮어, 하나의 결정을 만들다.
description: Board Snapshot · STOMP 실시간 · Spotlight 선점 · Kafka를 쓰지 않은 이유
image: '/images/2026-11-12-BRAIVIO_Dev/브레이비오 협업 결정 캔버스.png'
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

```
Workspace 생성 
→ Sticky / Text로 아이디어 정리 
→ Source · Evidence · Candidate Card 배치 
→ Evidence ↔ Candidate 관계 연결 
→ 실시간 협업 · 댓글 · 리액션 
→ Vote Session 
→ Decision 확정 (Snapshot 보존)
```

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

**세션 + CSRF를 선택한 이유 (JWT 미사용)**

브라우저 SPA와 쿠키 기반 협업 보드라는 전제에서, **JWT/Bearer는 쓰지 않고** 토큰을 JS에 두지 않는 **HttpOnly 세션 쿠키 + CSRF** 조합을 먼저 고정했습니다.  
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

### Board Snapshot — 전체 원본을 한 번에 읽는다

실시간 협업을 이야기하기 전에, 먼저 **보드의 유효한 상태가 어디에 있는지**를 고정해야 했습니다.  
BRAIVIO에서 Board Snapshot은 “이벤트 로그를 재생한 결과”가 아니라 **지금 서버가 인정하는 캔버스 전체 상태의 한 장짜리 복사본**입니다.

**스냅샷에 들어가는 것**

| 필드 | 내용 |
|------|------|
| workspaceId | 대상 공간 |
| objects | soft-delete되지 않은 보드 객체 전부 (위치·크기·version·스타일·도메인 카드 요약) |
| connections | 객체 간 연결선 |

카드형 객체는 board_objects만으로는 부족합니다. Source/Evidence/Candidate/Vote/Decision의 **요약(reference)** 을 각 도메인 Provider가 채워, 클라이언트가 카드 UI를 바로 그릴 수 있게 합니다.

**서버 흐름**

1. READ 권한 검사  
2. 살아 있는 board_objects 조회  
3. 참조 ID별로 도메인 요약 일괄 조회  
4. connections를 붙여 Snapshot 반환  

API는 **GET /api/v1/workspaces/{id}/board** 한 번입니다.

**프론트에서 스냅샷을 사용하는 시점**

| 시점 | 역할 |
|------|------|
| 캔버스 진입 | Snapshot 1회 로드 → BoardWorkspace 초기 상태 |
| 이후 일반 편집 | Query 자동 refetch로 덮지 않음 (로컬 + 실시간 이벤트가 주인) |
| version 충돌 (409) | Snapshot 재조회로 서버 상태에 수렴 |
| WebSocket 재연결 | 놓친 durable 이벤트를 메우기 위해 Snapshot 재조회 |
| 드래그 중 | Snapshot 미사용. Ghost만 보내고, 손 뗄 때 REST로 최종 위치 저장 |

**유효한 상태는 항상 REST(스냅샷/객체 API)** 이고, 실시간은 “누가 바꿨는지 빨리 알려 주는 층”입니다.  
이벤트를 몇 개 놓쳐도 Snapshot만 다시 받으면 보드가 복구됩니다.

------

### 실시간 협업 — Durable vs Volatile

실시간 계층을 한 채널에 섞지 않고, 성격이 다른 두 갈래로 나눴습니다.

| 구분 | 예시 | 저장 | 전달 |
|------|------|------|------|
| **Durable** | 객체 CRUD, 연결선, 댓글, 리액션, 플레이리스트, 멤버 변경 | MySQL | REST 커밋 후 board 토픽 |
| **Volatile** | Presence, 커서, 드래그 프리뷰, 회의 타이머/Spotlight | 인메모리 | presence 토픽 |

**왜 이렇게 나눴는가**

- 드래그 중 좌표를 매번 DB에 쓰면 부하와 version 충돌이 커집니다.  
  → 드래그는 Preview만 보내고, **손 뗄 때 REST로 최종 좌표 저장**
- WebSocket이 끊겨도 REST로 조회·수정이 가능해야 합니다.  
  → 재접속 시 Board Snapshot으로 복구
- MVP는 **단일 서버 STOMP Simple Broker**. Redis Pub/Sub 다중 인스턴스 확장은 P1로 남겨 두었습니다.

**STOMP 채널 구조**

```text
브라우저 ──► /ws  (세션 쿠키 + CSRF)
  클라 → 서버:  /app/workspaces/{id}/presence|cursor|drag-preview|meeting
  서버 → 클라:  /topic/workspaces/{id}/board      (durable)
                /topic/workspaces/{id}/presence   (volatile)
                /user/queue/errors                 (개인 에러, 예: Spotlight BUSY)
```

**STOMP 연결은 어떻게 붙는가**

JWT로 소켓을 여는 방식이 아니라, REST와 같은 **세션 + CSRF**로 연결합니다.

| 단계 | 담당 | 내용 |
|------|------|------|
| 1. Handshake | `/ws` + CsrfCapturingHandshakeInterceptor | `XSRF-TOKEN` 쿠키를 세션 attribute에 보관, Origin 검사 |
| 2. CONNECT | RealtimeChannelInterceptor | 로그인 Principal 확인 + `X-XSRF-TOKEN`이 Handshake 값과 일치하는지 검증 |
| 3. SUBSCRIBE | 동일 Interceptor | `/topic/.../board\|presence`만 허용, Workspace READ 권한 |
| 4. SEND | 동일 Interceptor | `/app/.../cursor\|drag-preview\|presence\|meeting`만 허용, 권한 + rate limit |
| 5. 처리 | RealtimeController | Ping·커서·드래그·Meeting을 presence 토픽으로 브로드캐스트 |

브로커는 MVP에서 **인프로세스 Simple Broker**(`/topic`, `/queue`)이고, Heartbeat 10초로 연결 생존을 확인합니다.  
프론트는 연결 전 CSRF를 읽어 CONNECT 헤더에 넣고, board/presence를 구독한 뒤 presence Ping으로 입장합니다.

**Presence · 커서 · 드래그**

| 기능 | 설계 |
|------|------|
| Presence | 주기적 Ping + stale 만료. JOIN/LEFT 시 참여자 목록 동기화. 다중 탭은 sessionId로 구분 |
| 커서 | 월드 좌표 + 선택 객체 ID. 줌과 무관하게 보이도록 화면 스케일을 보정 |
| 드래그 Ghost | 이동 중에는 반투명 미리보기만 브로드캐스트. 최종 위치는 REST 1회로 확정 |
| Rate limit | 클라이언트 throttle + 서버 세션당 상한. 초과 프레임은 조용히 drop |

프론트는 접속자 아바타, 원격 커서, 선택 하이라이트, Follow(아바타 클릭으로 시선 추적), 연결 상태 배너(connected / reconnecting / offline)를 제공합니다.

**한 장면으로 이어 보기**

A가 Sticky를 만들고 B가 같은 보드를 볼 때:

```text
[A] REST POST /board/objects
      └─ TX: INSERT + WorkspaceEvent(OBJECT_CREATED) 발행
            └─ Commit 성공
                  └─ DurableEventBroadcaster → STOMP board 토픽

[B] board 토픽 구독 중
      └─ OBJECT_CREATED 수신 → 로컬 객체 목록에 Sticky 반영
```

A가 객체를 드래그 중일 때:

```text
[A] WS drag-preview (약 15Hz)  →  [B] Ghost만 표시
[A] 마우스 업 → REST position + version
      └─ Commit 후 OBJECT_MOVED →  [B] 최종 좌표 확정, Ghost 제거
```

------

### 이벤트 발행과 구독 — Commit Before Broadcast

외부 메시지 버스 없이도 “발행/구독”은 분명히 있습니다.  
다만 형태가 **앱 내부 Spring 이벤트 + STOMP 토픽**입니다.

**1) 발행 (Publish) — Application Service**

보드·댓글·투표·플레이리스트·멤버 등 쓰기 유스케이스가 트랜잭션 안에서 WorkspaceEvent를 발행합니다.

```text
BoardServiceImpl.create / update / move / delete
  → events.publishEvent(WorkspaceEvent.of(workspaceId, "OBJECT_...", actorId, payload))
```

WorkspaceEvent는 eventId, workspaceId, type, actorId, occurredAt, payload를 담는 영속 변경 알림의 소스입니다.  
이 시점에서는 아직 클라이언트에게 보내지 않습니다. **DB 커밋이 성공해야만** 밖으로 나갑니다.

**2) 서버 내부 구독 — DurableEventBroadcaster**

Realtime 모듈의 리스너가 WorkspaceEvent를 구독합니다.

- **@TransactionalEventListener** 사용 → **커밋 성공 후에만** 실행  
- 롤백되면 브로드캐스트도 없음 (**Commit Before Broadcast**)  
- RealtimeEnvelope로 감싼 뒤 **/topic/workspaces/{id}/board** 로 convertAndSend  

같은 패턴의 다른 리스너도 있습니다.

| 리스너 | 구독 이벤트 | 하는 일 |
|--------|-------------|---------|
| DurableEventBroadcaster | WorkspaceEvent | 참여자에게 durable 알림 |
| SourceMetadataWorker | SourceRegisteredEvent | 커밋 후 URL 메타 비동기 fetch |
| PresenceService | WorkspaceMemberRemovedEvent | 강퇴 대상 소켓 정리 (MEMBER_REMOVED 브로드캐스트 이후) |

**3) 프론트 구독 — useRealtime**

캔버스 진입 후 STOMP 연결이 되면:

1. **board 토픽** 구독 → durable 이벤트를 onDurableEvent로 전달  
2. **presence 토픽** 구독 → 커서·Ghost·Presence·Meeting  
3. **presence Ping** publish → JOIN + (활성 중이면) Meeting 상태 재푸시  

durable 타입별 프론트 처리 예:

| 이벤트 | 동작 |
|--------|------|
| OBJECT_CREATED / UPDATED / MOVED | 로컬 객체 패치 |
| OBJECT_DELETED | 로컬에서 제거 |
| REFERENCE_UPDATED | 카드 요약 갱신 (투표는 본인 표 재조회) |
| CONNECTION_* | 엣지 목록 갱신 |
| COMMENT_* / REACTION_* | 스레드·카운트 갱신 |
| MEMBER_REMOVED (나) | 홈으로 이동 + 재연결 루프 차단 |
| 재연결 성공 | Snapshot 재조회로 놓친 이벤트 복구 |

**설계상 중요한 분리**

- 이벤트는 **알림**이지 원본이 아니다  
- 원본은 MySQL + Snapshot/객체 REST  
- 그래서 브로드캐스트가 실패하거나 클라이언트가 놓쳐도 Snapshot으로 수렴 가능하다  

------

### 왜 Kafka를 쓰지 않았는가

실시간·이벤트를 설계할 때 Kafka를 후보로 두지 않은 것은 “모른다”가 아니라 **이 제품의 문제가 Kafka가 풀기에 맞는 문제가 아니었기 때문**입니다.

**전달해야 할 것**

1. Durable: DB에 이미 저장된 변경을 **같은 Workspace에 붙어 있는 소수 브라우저**에 알림  
2. Volatile: 커서·드래그·Spotlight처럼 **저장하지 않는** 짧은 상태  

서비스 간 비동기 파이프라인, 장기 감사 로그 재생, 대량 컨슈머 팬아웃이 목표가 아닙니다.

| Kafka가 강한 지점 | BRAIVIO MVP |
|------------------|-------------|
| 여러 마이크로서비스 간 이벤트 | Modular Monolith 하나 |
| 장기 보관·재생·재처리 | 진실은 MySQL + Board Snapshot |
| 높은 처리량·파티션 확장 | 보드당 동시 편집자 소수 |
| 장애 격리·백프레셔 | 단일 서버 + Simple Broker면 충분 |

브라우저까지 가려면 결국 WebSocket이 필요합니다.  
Kafka를 넣어도 **Kafka → 앱 서버 → STOMP** 한 단이 더 생기고, MVP 복잡도만 커집니다.

**실제로 고른 스택**

```text
쓰기 TX 안: Spring WorkspaceEvent 발행
     ↓ Commit
DurableEventBroadcaster → STOMP Simple Broker → 구독 중인 브라우저
(유실·재접속) → Board Snapshot 재조회
```

수평 확장이 필요해지면 **1단계는 Redis Pub/Sub**(다중 인스턴스 Presence/이벤트 중계)로 문서에 남겨 두었습니다.  
Kafka는 그다음, 예를 들어 알림·검색 인덱싱·감사 파이프라인처럼 **다른 서비스가 보드 변경을 비동기로 소비**해야 할 때 다시 검토할 대상입니다.

------

### Meeting 타이머와 Spotlight

의사결정 보드에서는 “지금 이 카드를 같이 보자”, “3분만 이야기하자” 같은 **짧은 진행 보조**가 필요합니다.  
음성·영상 통화 없이, 캔버스 시선과 시간만 맞추는 쪽으로 범위를 잡았습니다.

**Meeting 타이머**

- 상태: 시작 → 일시정지 → 재개 → 종료
- 서버는 **남은 ms만** 뿌리지 않고 **절대 종료 시각(endsAt)** 을 브로드캐스트
- 클라이언트는 로컬 틱(250ms)으로 카운트다운 → 기기 간 시계 오차를 줄이는 방식
- DB/Board Snapshot에 넣지 않는 **휘발 상태**. 서버 재시작 시 타이머는 사라짐
- 편집 권한이 있는 멤버만 제어, VIEWER는 조회만

------

### Spotlight 기술 구현 — 시선 공유를 서버 상태로

**문제 정의**

초기에는 아바타를 눌러 커서를 따라가는 **Follow**만으로도 “같이 보기”가 된다고 봤습니다.  
하지만 회의에서는 진행자가 바뀌고, 두 사람이 동시에 “나를 보라”고 눌러 시선이 갈라질 수 있습니다.  
그래서 Follow(개인이 선택하는 추적)와 별도로, **서버가 단 한 명의 진행자를 소유하는 Spotlight**를 만들었습니다.

Spotlight의 UX 한 줄:

> 진행자가 선택 객체(또는 좌표)를 선언하면, 다른 참여자 뷰포트가 그 지점으로 부드럽게 따라가고 대상 카드가 하이라이트된다.

**저장하지 않는 이유**

Spotlight는 보드의 영속 데이터가 아닙니다.  
Board Snapshot/MySQL에 넣지 않고, Workspace별 **인메모리 MeetingState**에만 둡니다.

| 필드 | 의미 |
|------|------|
| spotlightMemberId | 진행자 회원 |
| spotlightSessionId | 진행자 탭(같은 회원 다중 탭 구분) |
| spotlightNickname | BUSY 안내용 표시 이름 |
| spotlightObjectId | 따라갈 카드 (있으면 카드 중심) |
| spotlightX / Y | 카드가 없을 때 월드 좌표 |

서버 재시작·빈 인스턴스면 Spotlight는 사라지고, 다시 ON하면 됩니다.  
“지금 회의 진행”용 휘발 상태라서 Snapshot 복구 대상이 아닙니다.

**메시지 경로**

```text
[진행자 UI]
  → STOMP /app/workspaces/{id}/meeting
       action: SPOTLIGHT_ON | UPDATE | OFF
  → MeetingService.apply (EDIT_BOARD 권한 검사)
  → MeetingStateRegistry에 상태 반영
  → /topic/.../presence 로 MEETING_STATE 브로드캐스트

[다른 참여자]
  → useRealtime presence 구독
  → onMeetingEvent → useMeeting.apply
  → BoardWorkspace가 setCenter + 카드 하이라이트
```

보드 durable 토픽이 아니라 **presence(휘발) 토픽**을 쓰는 것도 의도입니다.  
객체 CRUD와 시선 상태를 같은 채널에 섞지 않기 위함입니다.

**선점 · 충돌 · 인수 규칙**

서버 MeetingService.spotlightOn이 단일 레지스트리에서 직렬화합니다.

| 상황 | 동작 |
|------|------|
| 비어 있음 | EDITOR가 ON → 진행자 됨 |
| 같은 memberId 재개 | 허용 (탭 재연결·토글 시 자기 자신에 BUSY 방지) |
| 다른 사람이 점유 | EDITOR는 **SpotlightBusyException** → /user/queue/errors 로 SPOTLIGHT_BUSY |
| OWNER + force=true | 확인 UI 후 강제 인수 |
| OFF | 본인 또는 OWNER만 |
| UPDATE | **본인 sessionId**와 일치할 때만 반영. 강제 인수 후 구 세션의 UPDATE는 무시 |

이렇게 해야 “진행자가 둘”이 되지 않고, 강탈 후에도 이전 탭이 상태를 덮어쓰지 않습니다.

**프론트 시선 동기**

1. 내가 진행자가 아니면 spotlightObjectId의 노드 중심(또는 x/y)으로 **setCenter(duration ≈ 280ms)**  
2. 대상 카드에 spotlight 아웃라인 표시  
3. 진행자 본인은 선택 변경·포인터 이동 시 **SPOTLIGHT_UPDATE**로 좌표/객체 갱신  
4. spotlightLocal 플래그로 낙관적 UI를 유지하고, 타인이 인수하면 로컬 플래그를 해제  

**Follow와의 우선순위**

| 모드 | 성격 |
|------|------|
| Follow | 내가 고른 참여자 커서를 추적 (개인 선택) |
| Spotlight | 서버가 정한 진행자를 전원이 따름 (회의 진행) |

Follow가 켜져 있으면 Spotlight보다 **Follow가 우선**합니다.  
수동 팬이나 Esc로 Follow를 끄면 다시 Spotlight 시선을 따릅니다.  
두 축을 합치지 않은 이유는, “개인적으로 누구를 볼지”와 “회의에서 공적으로 어디를 볼지”를 분리하기 위해서입니다.

**재입장 시**

Presence Ping 때 MeetingService.pushSnapshot이 호출됩니다.  
타이머나 Spotlight가 **실제로 활성일 때만** MEETING_STATE를 다시 밀어, 빈 상태로 Presence 채널을 시끄럽게 만들지 않습니다.

**트러블슈팅에서 다듬은 점**

- 이중 선점 → 서버 단일 상태 + BUSY / OWNER force  
- 같은 회원 재연결 시 자기 busy → “본인 재개” 허용  
- 강제 인수 후 구 탭 UPDATE → sessionId 일치 검사로 무시  
- Follow만으로 부족했던 UX → 서버 권위형 Spotlight로 확장  

결과적으로 Spotlight는 CRDT도, Board Snapshot도 아닌 **회의용 휘발 Presence 상태**로,  
권한·선점·시선 동기만 서버가 권위를 갖는 얇은 실시간 기능입니다.

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
- 이벤트 경계를 Spring TX 이벤트(발행) + Commit-after broadcast(구독 전달)로 단순화하고
- 동시성 경계를 version 충돌 + **Board Snapshot 복구**로 닫았습니다.

Kafka 없이 실시간 협업이 가능한 이유도 같습니다.  
**원본은 DB와 Snapshot**이고, 이벤트는 알림일 뿐이며, 브라우저까지의 마지막 구간은 STOMP면 충분했습니다.

그 결과, 프론트는 카드와 협업 UX에 집중하고, 백엔드는 권한·규칙·영속·브로드캐스트에 집중하는 구조가 되었습니다.

다음 단계로는 OAuth 로그인, Redis 기반 수평 확장, 비교 테이블 같은 P1 기능을 제품 검증 결과에 맞춰 확장할 예정입니다.
