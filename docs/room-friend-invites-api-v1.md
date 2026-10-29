# Friends Room Invitations V1 — 시스템·디자인 연동 API

작업: [#82](https://github.com/SuperNova080710/Alkkagi/issues/82) · SQL [#83](https://github.com/SuperNova080710/Alkkagi/issues/83) · API [#84](https://github.com/SuperNova080710/Alkkagi/issues/84) · 검증 [#85](https://github.com/SuperNova080710/Alkkagi/issues/85).

**작업 브랜치:** `feat/backend-room-invites-v1`. 새 SQL/API는 아직 `main`과 운영 Supabase에 적용되지 않았습니다. 메신저 [PR #81](https://github.com/SuperNova080710/Alkkagi/pull/81)과 의존 관계 없이 분리했습니다.

## 의존성과 적용 순서

- 기존 일반전 방 `rooms`/`room_players`, 대기실 방 참가 RPC 및 AI전 시작 로직 사용.
- 친구 기반 `friend_links`와 `player_blocks`는 #76의 `202610290005_friends_v1.sql`에 정의되어 있습니다.
- 마이그레이션 `202610290007_room_friend_invites_v1.sql`은 반드시 **005 친구 기능 후** 적용합니다. 보안 `004` 및 메신저 `006`과 파일 중복이 없으며, 006 메신저 기능을 사용하지 않습니다.
- 2026-10-29 운영 Supabase 마이그레이션 조회 당시 004/005/006/007은 적용 이력이 없었습니다. **GitHub merge는 Supabase SQL 적용을 의미하지 않습니다.**
- 운영 DB에 SQL을 직접 적용하거나 main에 병합하는 일은 사용자 승인 후 별도 진행합니다.

## REST API 계약

모두 사용자 Supabase Auth 세션 필수. 성공 응답 `{ "data": ... }`, 오류 응답 `{ "error": "CODE" }`. `Cache-Control: private, no-store`, `Vary: Cookie` 적용.

| Method | URL | Body/Query | Success `data` |
| --- | --- | --- | --- |
| GET | `/api/room-invites` | 없음 | 받은 활성 초대 배열 |
| GET | `/api/room-invites/sent?roomId=UUID` | 방 UUID | 내가 호스트인 방의 보낸 초대 배열 |
| POST | `/api/room-invites` | `{"roomId":"UUID","targetId":"UUID"}` | `{inviteId,status:"pending",expiresAt,alreadyPending}` |
| POST | `/api/room-invites/:inviteId/respond` | `{"accept":true}` 또는 `false` | `{inviteId,status:"accepted"\|"declined",roomId:"UUID"\|null}` |

`POST`는 same-origin `Origin`, JSON Content-Type, 스트림 기준 2,048바이트 이하의 정확한 JSON 필드만 허용합니다. actorId/호스트 ID 등 사용자 ID를 외부에서 받지 않습니다. 상대 ID는 `GET /api/friends`의 `friends[].id`를 사용합니다.

### 받은 초대

```json
{
  "data": [{
    "id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "roomId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "inviterId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "inviterNickname":"플레이어",
    "createdAt":"2026-10-29T05:30:00Z",
    "expiresAt":"2026-10-29T05:35:00Z"
  }]
}
```

**초대 코드(code), 이메일, 랭크 전적·상대의 비공개 프로필 정보는 포함하지 않습니다.** 받은 초대는 아직 일반전 방 참가 권한이 아닙니다. 수락 성공 후 반환된 `roomId`를 이용해 `/rooms/:roomId`로 이동합니다. 방 접근 권한은 수락 RPC가 seat 2에 추가한 뒤에만 생깁니다.

### 보낸 초대

`GET /api/room-invites/sent?roomId=...`의 데이터 요소는 다음과 같습니다.

```json
{
  "id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "inviteeId":"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "inviteeNickname":"친구",
  "status":"pending",
  "createdAt":"2026-10-29T05:30:00Z",
  "expiresAt":"2026-10-29T05:35:00Z"
}
```

`status`는 `pending`, `accepted`, `declined`, `expired`. 이미 친구가 아니거나 차단된 사용자의 `inviteeNickname`은 null로 표시합니다. 방 호스트만 조회할 수 있습니다.

## 보안·규칙

- **호스트 검증:** 최초 방 생성자가 seat 1인 유효한 `waiting` 방에서만 보냅니다. 사람이 seat 2에 들어왔거나 AI전·일반전 시작·방 종료/만료이면 거부합니다.
- **친구·차단 검증:** `friend_links.status='accepted'`, 상호 `player_blocks` 없음. 발송·조회·수락 시 계속 확인합니다. 친구 해제·차단·방 종료 후 초대는 받은 목록에서 사라지고 수락할 수 없습니다.
- **만료/중복:** 보낸 초대의 TTL은 5분. 한 방+수신자 조합은 UNIQUE이므로 재전송 시 동일한 pending 초대 ID와 `alreadyPending:true`를 반환합니다. 거절·만료된 초대는 같은 방에서 다시 생성하지 않습니다.
- **남용 한도:** 호스트당 최근 10분 생성 20건, 동시에 유효한 보낸 대기 초대 10건, 수신자당 동시 유효 초대 20건. 한도를 초과하면 429.
- **원자적 좌석:** 수락 RPC는 호스트/수신자 프로필 행을 ID 순서로 잠그고, 기존 `rooms` 행을 `FOR UPDATE` 잠근 뒤 seat 2 비어 있음 및 AI/일반전 미시작을 확인하고 INSERT합니다. 기존 코드 초대 참가 RPC도 같은 방 행을 잠그므로 단일 좌석만 성공해야 합니다.
- **테이블 직접 접근:** `room_friend_invites` RLS ON, `anon`/`authenticated` 직접 SELECT/WRITE 없음. 네 가지 제한된 `SECURITY DEFINER` RPC만 인증 회원에게 실행 가능. API는 내부 SQL 오류를 표시하지 않습니다.
- **데이터 보존:** 만료·거절 기록은 중복/스팸 방어를 위해 남으며, 사용자 삭제나 방 삭제 시 외래 키 CASCADE로 정리. 운영 보관 기한/정리 작업은 추후 정책 필요.
- 기존 랭크 RP·물리 엔진·AI 상태·일반전 코드 참가 경로는 변경하지 않았습니다. 친구 초대로 새 랭크전이 생성되지 않습니다.

## 오류 계약

| HTTP | 오류 | 의미 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 비로그인 |
| 403 | `ORIGIN_NOT_ALLOWED` | 다른 출처 |
| 400 | `INVALID_REQUEST`, `INVALID_ROOM_INVITE` | JSON·ID·형식 오류 |
| 404 | `ROOM_NOT_AVAILABLE` | 호스트 아님, 방 종료/만료, 인원 초과, AI 시작 |
| 404 | `FRIEND_NOT_AVAILABLE` | 친구 관계/차단 경계 (차단 사실 구분 노출 안 함) |
| 404 | `ROOM_INVITE_NOT_FOUND` | 수신자가 아님·만료·취소된 상태·권한 불충족 |
| 409 | `ROOM_INVITE_ALREADY_SENT` | 동일 방으로 재초대 불가 |
| 429 | `ROOM_INVITE_RATE_LIMIT`, `ROOM_INVITE_INBOX_FULL` | 생성 또는 수신 한도 초과 |
| 503 | `ROOM_INVITE_SERVICE_UNAVAILABLE` | DB/서버 내부 오류, 상세 비노출 |

## 디자인 채팅 인계

- 로비/대기실 화면·초대 대상 선택은 **디자인 채팅**에서 구현합니다.
- 방 주인 UI에서 `GET /api/friends`로 친구 ID 획득 → `POST /api/room-invites`로 발송 → `GET /api/room-invites/sent`로 상태 조회.
- 수신자 UI에서 `GET /api/room-invites`로 목록 갱신 → `POST .../:inviteId/respond`로 수락/거절 → 성공 시 `/rooms/:roomId`로 이동.
- 별도 Realtime publication은 이 V1에 추가하지 않았습니다. DB 트리거 기반 알림이 아닌 **화면 진입/복귀·수동 갱신 또는 적절한 저빈도 폴링**으로 목록 갱신을 구현합니다. 무료 플랜 DB 자원 고려해 과도한 주기 폴링은 지양합니다.
- 시스템 담당 수정 범위: 신규 SQL, `src/app/api/room-invites/**`, `src/lib/room-invites/**`, `src/proxy.ts` 한 줄, 테스트·문서. 디자인의 JSX/CSS·모바일 인터랙션 파일은 수정하지 않습니다.
- 본 PR 병합·운영 DB 적용 전까지 사용자에게 기능이 정상 작동한다고 표시하지 마세요.

## 검증의 한계

- [ ] PGlite 단일 연결: 기존 일반전/AI전/친구 권한, 유효/무효 초대·방 좌석 경쟁 순서
- [ ] HTTP mock: 인증/CSRF/JSON·ID 검증, 안전한 오류 응답
- [ ] GitHub Actions lint/typecheck/Vitest/Next build, Vercel Preview
- [ ] 실제 Supabase DB 적용 및 복수 DB 연결의 동시 좌석 선점, 2계정 브라우저 테스트 (사용자 후속 승인 필요)
