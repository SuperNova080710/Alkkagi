# Direct Messages V1 — 시스템 / UI 연동 계약 (2026-10-29)

## 적용 상태 / 선행 의존성
- 시스템 이슈 [#77](https://github.com/SuperNova080710/Alkkagi/issues/77), SQL #78, HTTP #79, CI·인계 #80.
- 이전 친구 백엔드 PR #76, 보안 PR #69는 **GitHub main에 병합됨**. 2026-10-29 조회한 Supabase 운영 migration history에는 `202610290004` / `202610290005` 적용 기록이 없었음. **코드 병합은 DB 적용을 의미하지 않습니다.**
- 이 메신저는 `202610290006_direct_messages_v1.sql`을 사용하는 **별도 미병합 작업 브랜치**입니다. 운영 DB DDL/사용자 데이터 변경 없음.
- 운영 적용 시 순서: (1) #69 `202610290004_security_room_create_limits.sql`, (2) #76 `202610290005_friends_v1.sql`, (3) 본 PR `202610290006_direct_messages_v1.sql`. 실제 migration history 및 객체 확인 후 **별도 사용자 승인**으로 적용해야 합니다.
- **중요:** 친구 요청·수락과 실계정 두 명을 이용한 브라우저/Realtime E2E는 DB 적용 이전에는 성공했다고 주장할 수 없습니다.

## 기능

* **친구만 채팅:** `friend_links.status='accepted'`이고 양방향 차단이 없을 때만 새 메시지 전송/열람.
* **차단·친구 해제:** 조회, 실시간 Postgres Changes INSERT 수신, 전송 모두 RLS에 의해 제한됨. 과거 메시지는 DB에 보관되며, **나중에 재수락한 경우 과거 내역에 다시 접근할 수 있습니다**. 이것은 메시지 영구 삭제 기능이 아닙니다.
* **서버 보관:** 1:1 스레드 한 쌍당 유일한 `dm_threads`, `dm_messages`, 읽음 커서 `dm_read_state`.
* **재전송 방지:** 클라이언트가 한 번 생성한 `requestId` UUID를 통신 재시도에도 동일하게 사용하면 서버가 동일한 메시지 ID를 반환(`alreadySent:true`)하며 중복 저장하지 않음.
* **스팸 한도:** 스레드·발신자당 1초 1건, 발신자당 같은 스레드에서 최근 24시간 200건, 스레드당 총 5,000건, 본문 1~500자(양끝 공백 제거). 차단/친구 관계 변경과 메시지 전송 모두 프로필 두 행을 정렬 순서로 잠금.
* **읽음:** 해당 스레드에 존재하는 `messageId`까지 읽음 표시. 이전 읽음 ID로 역행 금지. 상대방의 읽음 여부는 **이번 V1에서 노출하지 않음**.
* **Realtime:** Supabase Free에서 사용 가능한 Postgres Changes `INSERT` 이벤트. `dm_threads`, `dm_messages`를 `supabase_realtime` publication에 등록. 클라이언트 SELECT는 친구+비차단 조건의 RLS로 제어. **웹소켓 알림을 최종 진실로 사용하지 않고 반드시 API로 동기화**.

## HTTP 계약

모든 API는 로그인 세션을 서버의 Supabase Auth `getUser()`로 검증합니다. 성공 `{ "data": ... }`, 실패 `{ "error": "CODE" }`, 헤더 `Cache-Control: private, no-store` 및 `Vary: Cookie`.

| 메서드 | 경로 | 요청 | 주요 응답 |
| --- | --- | --- | --- |
| GET | `/api/messages` | 없음 | 대화 배열 `[{threadId,userId,nickname,lastAt,lastMessage,unreadCount}]` |
| GET | `/api/messages/:peerId` | `?before=123&limit=30` (선택) | `{threadId,messages,hasMore}` |
| POST | `/api/messages/:peerId` | `{"body":"안녕하세요","requestId":"UUID"}` | `{threadId,id,senderId,body,createdAt,alreadySent}` |
| PUT | `/api/messages/:peerId/read` | `{"messageId":"123"}` | `{threadId,lastReadId:"123"}` |

- `peerId`는 상대 플레이어 UUID. 기존 `GET /api/friends`의 `friends[].id`를 그대로 사용합니다.
- `messageId`는 PostgreSQL bigint지만 프론트엔드 안전을 위해 **문자열**로 주고받습니다. `id`를 JS 숫자로 변환하지 마세요.
- `GET` 메시지 목록은 **최신 순**(ID 내림차순)으로 최대 50개입니다. UI는 표시할 때 역순으로 변환하세요. `before`는 마지막 메시지의 ID(미포함)를 그대로 지정합니다.
- 친구지만 아직 채팅을 시작하지 않았으면 `{threadId:null,messages:[],hasMore:false}`입니다.
- `POST`·`PUT`은 동일 출처 `Origin` 및 `Content-Type: application/json`, 실제 스트림 포함 4,096 바이트 이내. 본문은 정의된 필드만 허용하며 클라이언트의 `senderId`/타인 읽음 상태는 받지 않습니다.
- 읽음 배지 카운트는 내 메시지를 제외한 상대방 발신 메시지 중 `last_read_id`보다 ID가 큰 항목 수입니다.

### 예시

```json
{
  "data": {
    "threadId": "00000000-1111-4222-8333-444444444444",
    "messages": [
      {
        "id": "22",
        "senderId": "11111111-1111-4111-8111-111111111112",
        "body": "안녕하세요",
        "createdAt": "2026-10-29T05:12:34Z"
      }
    ],
    "hasMore": false
  }
}
```

### 오류 코드

| HTTP | `error` | 동작 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 로그인 |
| 403 | `ORIGIN_NOT_ALLOWED` | 거부; 다른 출처 요청 |
| 400 | `INVALID_REQUEST`, `DM_INVALID_MESSAGE`, `DM_INVALID_MESSAGE_ID`, `DM_INVALID_PAGE` | 올바른 값 재입력 |
| 404 | `DM_NOT_AVAILABLE` | 친구 관계 없음·차단됨·존재하지 않는 상대를 동일 오류로 처리 |
| 429 | `DM_RATE_LIMIT`, `DM_DAILY_LIMIT` | 잠시 후 재시도/일일 제한 |
| 409 | `DM_THREAD_FULL` | 현재 스레드 최대 저장 한도 도달 |
| 503 | `DM_SERVICE_UNAVAILABLE` | 서버/DB 연결 오류. 내부 SQL 오류는 노출 금지 |

## UI 실시간 구독 예시 (인계용 — UI 변경 아님)

인증된 브라우저 Supabase 클라이언트를 별도로 준비해야 합니다(`@supabase/ssr`의 `createBrowserClient`, publishable key만 사용). 서비스 역할 키는 클라이언트에 전달하지 마세요. 다음은 **기존 `supabase` 인스턴스를 받아서 쓰는 설계 예시**입니다.

```ts
// 새 대화 스레드가 생기면 inbox API 재조회
const threadChannel = supabase
  .channel('my-dm-threads')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'dm_threads',
  }, () => refreshInbox())
  .subscribe();

// 대화 API의 threadId가 null이 아니면 해당 스레드의 새 메시지 구독
const messageChannel = supabase
  .channel('my-dm-messages-' + threadId)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'dm_messages',
    filter: 'thread_id=eq.' + threadId,
  }, () => {
    refreshMessages(); // 반드시 API를 통해 최신 커서로 재조회
    refreshInbox(); // 읽지 않은 수 갱신
  })
  .subscribe();

// 화면 이동/로그아웃 때:
supabase.removeChannel(messageChannel);
supabase.removeChannel(threadChannel);
```

**주의:** `dm_threads` 새 행 이벤트는 기존 친구에게만 RLS로 전달되며, 실제 동작은 Supabase의 Realtime 권한·인증 토큰/설정에 의존합니다. 메시지 구독은 채널 연결 끊김, 브라우저 백그라운드, 최초 진입 타이밍 등으로 알림을 놓칠 수 있으므로 진입 시·재연결 시·포커스 복귀 시 HTTP로 동기화해야 합니다. 차단/친구 해제 때 채널을 제거하고 메시지를 메모리에서 지우며 API 재검증을 실시하세요.

**보안/무료 플랜:** Supabase Postgres Changes는 RLS SELECT 정책으로 INSERT 이벤트 접근을 제어합니다. 더 높은 트래픽에서는 Broadcast 기반 구조를 검토해야 합니다. Free 리얼타임 한도는 동시 연결·메시지량 제한이 있으므로 지속적인 폴링보다 이벤트+필요 시 HTTP 재조회 권장. 기존 게임 화면 채팅은 변경하지 않음.

## 미구현과 후속 이슈

- 친구와 대화 화면·채팅 입력 컴포넌트·모바일 UI: **디자인 담당**.
- 이미지/파일 첨부, 타이핑 표시, 푸시 알림, 신고·관리자 제재, 차단된 상대의 과거 대화 삭제·계정 탈퇴 보존 기간 정책: 범위 외.
- 대전방 초대 연결: 별도 백엔드 기능/디자인 UI 이슈로 진행.
- **보안 운영 작업 선행:** #69/PR #76/본 PR의 SQL 적용·Auth 실제 계정·RLS/실시간 검증 전에는 운영 기능을 사용 가능한 것으로 광고하지 마세요.

## 검증

- [ ] PGlite: 직접 쓰기 거부·익명/제3자 차단·친구 상태 전이·중복/레이트·커서·읽음
- [ ] HTTP: Origin/인증·악성 요청 본문·UUID·오류 마스킹
- [ ] GitHub Actions lint/typecheck/Vitest/Next.js build, Vercel Preview READY
- [ ] 운영 SQL 적용 및 실제 Realtime 구독·브라우저 A/B E2E (사용자 병합·적용 결정 후 별도)
