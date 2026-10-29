# Friends API V1 — 시스템 ⇄ UI/UX 연동 계약

상위 이슈 [#72](https://github.com/SuperNova080710/Alkkagi/issues/72), DB [#73](https://github.com/SuperNova080710/Alkkagi/issues/73), API [#74](https://github.com/SuperNova080710/Alkkagi/issues/74), 검증 [#75](https://github.com/SuperNova080710/Alkkagi/issues/75). 미래 기능 백로그 [#57](https://github.com/SuperNova080710/Alkkagi/issues/57).

**상태:** 시스템 기능은 작업 브랜치 `feat/backend-friends-v1`의 PR로만 제공. 병합 전에는 `main`의 UI에서 호출하지 마세요. 사용자 승인 없는 운영 Supabase migration 적용 없음.

## 병렬 개발 소유권

- **시스템:** `supabase/migrations/202610290005_friends_v1.sql`, `src/app/api/friends/**`, `src/lib/friends/**`, `src/proxy.ts`의 친구 API matcher, `tests/friends-*.test.ts`, 이 문서.
- **디자인:** 홈·대전 로비·프로필·랭킹·게임 화면 및 `src/components/**`, `src/app/globals.css`, `src/app/arena.css`, `src/app/layout.tsx`.
- **선행:** 공개 플레이어 검색/비공개 설정 [`docs/player-profile-api-v1.md`](./player-profile-api-v1.md), 기존 `/profile` 닉네임 설정, 기존 랭크 RP. 모두 그대로 유지.
- API/SQL/권한 변경이 필요하면 시스템 #72 이슈에 먼저 계약을 업데이트한 후 작업. 디자인은 SQL/RPC를 직접 수정하지 않음.

## API

모든 요청은 **로그인 필수** (서버 `auth.getUser()`). 오류 `{ "error": "CODE" }`, 성공 `{ "data": ... }`. 모든 응답은 `Cache-Control: private, no-store`, `Vary: Cookie`.

| 메서드 | 경로 | 요청 | 응답 |
| --- | --- | --- | --- |
| GET | `/api/friends` | 없음 | `{friends,incoming,outgoing,blocked}` |
| POST | `/api/friends/requests` | `{"targetId":"UUID"}` | `{requestId,status:"pending",alreadyPending:boolean}` |
| POST | `/api/friends/requests/:requestId/respond` | `{"accept":true}` 또는 `false` | `{requestId,status:"accepted"\|"rejected"}` |
| DELETE | `/api/friends/:userId` | 없음 | `{removed:boolean}` |
| PUT | `/api/friends/blocks/:userId` | `{"blocked":true}` 또는 `false` | `{userId,blocked}` |

`GET` 이외 모든 메서드는 동일 출처 `Origin` 필수입니다. `POST`/`PUT`은 `Content-Type: application/json`, **2 KiB 이내** 본문과 정의된 정확한 필드만 허용합니다. 클라이언트의 `actorId`·`user_id`는 받지 않습니다. Supabase Auth 세션 쿠키가 읽힐 수 있는 동일 출처 `fetch`를 사용하세요.

### 목록 응답 예시

```json
{
  "data": {
    "friends": [{"id":"11111111-1111-1111-1111-111111111112","nickname":"Bravo"}],
    "incoming": [{"id":"22222222-2222-2222-2222-222222222223","userId":"33333333-3333-3333-3333-333333333334","nickname":"Charlie","createdAt":"2026-10-29T00:00:00Z"}],
    "outgoing": [],
    "blocked": []
  }
}
```

`incoming/outgoing[].id`는 **요청 ID**(수락·거절용)이고, `userId`는 상대 **프로필 ID**입니다. `friends[].id`와 `blocked[].id`는 **상대 프로필 ID**입니다. 목록 기본 값은 모두 빈 배열이며, 타인의 이메일·RP·프로필 설정 행은 포함하지 않습니다. 공개 검색 결과를 먼저 보고 `targetId`로 친구 요청합니다.

**차단 목록 공개 범위:** `blocked[].nickname`은 `string | null`입니다. 상대가 `discoverable:false`로 설정했다면 관계 유무와 무관하게 `null`을 반환하며, 차단 해제에 필요한 `blocked[].id`만 유지합니다. 상대가 공개 설정으로 전환하면 다음 조회에 닉네임이 다시 표시됩니다. UI에서는 `null`을 안전한 기본 표시명(예: "비공개 플레이어")으로 렌더링하고 추가 프로필 조회를 시도하지 마세요. 알려진 UUID로 대상을 차단하는 기능 자체는 유지됩니다.

## 오류 매핑

| HTTP | 코드 | 의미 / UI 권장 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 로그인 이동 |
| 403 | `ORIGIN_NOT_ALLOWED` | 다른 출처 요청 차단 |
| 400 | `INVALID_REQUEST`, `INVALID_FRIEND_TARGET`, `INVALID_FRIEND_REQUEST`, `INVALID_BLOCK_TARGET` | 본문/UUID/자기 자신 확인 |
| 404 | `FRIEND_NOT_AVAILABLE` | 없는·검색 비공개·차단된 상대를 **동일한 오류**로 표시 |
| 404 | `FRIEND_REQUEST_NOT_FOUND` | 대상 요청을 찾지 못했거나 본인에게 온 요청이 아님 |
| 409 | `ALREADY_FRIENDS`, `INCOMING_FRIEND_REQUEST` | 이미 친구/받은 요청 확인 |
| 409 | `FRIEND_REQUEST_COOLDOWN` | 거절된 요청은 24시간 후 재요청 |
| 409 | `FRIENDS_FULL` | 상대 또는 나의 친구 최대 100명 |
| 429 | `FRIEND_REQUEST_LIMIT`, `FRIEND_INBOX_FULL`, `BLOCK_LIMIT` | 보낸 대기 요청 최대 20개, 받는 대기 요청 최대 40개, 차단 사용자 최대 100명 |
| 503 | `FRIEND_SERVICE_UNAVAILABLE` | API/DB 임시 오류; 내부 SQL 오류를 사용자에게 그대로 표시하지 않음 |

중복된 같은 방향 요청은 `200`과 `alreadyPending:true`로 재전송 안전하게 반환합니다. 반대 방향으로 대기 중인 요청이 있으면 새 요청을 만들지 않고 `INCOMING_FRIEND_REQUEST`를 반환하므로 기존 받은 요청을 수락하도록 안내합니다.

## 권한·상태 전이

1. 요청: 자기 자신에게 요청 불가, 상대 계정 존재/검색 공개 설정 확인, 양방향 차단 중이면 요청 불가. 한 사용자 쌍은 UNIQUE 표현식 인덱스로 **단 하나의 관계**만 유지합니다.
2. 대기 → 수락/거절: **받은 사람만** 응답합니다. 수락하면 양쪽 친구, 거절하면 `rejected` 상태 보존 및 마지막 응답 기준 24시간 쿨다운. 발신자 또는 수신자가 상대를 차단했다가 해제해도 거절 기록과 최초 거절 시각은 유지됩니다. 24시간이 지나면 재요청할 수 있습니다.
3. 친구 해제: 둘 중 누구든 `DELETE /api/friends/:userId` 가능. 이미 친구가 아니면 `removed:false`.
4. 차단: 차단한 사용자만 자신의 차단 항목을 확인/해제. 차단하면 기존 **수락 관계와 대기 요청**을 제거하되 거절된 요청의 쿨다운 근거(`rejected`)는 보존합니다. 반대편 신규 친구 요청도 차단합니다. **차단 상태를 상대에게 노출하지 않습니다.** 차단 대상이 비공개이면 목록의 닉네임도 공개하지 않습니다.
5. 데이터: `friend_links`, `player_blocks` RLS 활성화, 로그인 사용자는 관계에 포함된 본인 행/본인이 건 차단만 읽을 수 있음. DB 직접 INSERT/UPDATE/DELETE 없음; 인증 RPC의 `auth.uid()`만 변경 허용.
6. 동시성: 요청/수락/해제/차단은 **양 사용자 프로필 행을 UUID 정렬 순서로 FOR UPDATE 잠금**. UNIQUE 제약과 결합해 교차 요청의 중복 삽입 방지. 별도 실제 다중 연결 경합은 추가 검증 필요.
7. 대기/친구 수·거절 쿨다운으로 기본 남용 제한. **시간당 요청 횟수·IP기반 스팸 제어는 이번 범위 미포함**. 추가 악용 관찰 시 별도 이슈.
8. **비공개 프로필은 신규 친구 요청 대상에서 제외되지만**, 이미 수락한 친구/기존 요청이 자동 취소되지는 않습니다. 친구 목록은 그 관계에 필요한 닉네임만 조회합니다. 기존 랭크 TOP100은 친구 설정과 무관합니다.

## 디자인 연동 순서 (병합 후)

- `GET /api/players/search?q=...`로 검색 → `POST /api/friends/requests`로 요청.
- `GET /api/friends`로 받은 요청, 친구, 차단된 사용자 표시.
- 받은 요청의 `id`로 수락/거절; 친구 항목의 `id`로 친구 해제 및 차단.
- 요청 중/성공/실패·빈 목록/키보드 접근성을 표시. 닉네임 대소문자 검색은 기존 플레이어 API 계약 사용.
- 새 UI/메신저/실시간 온라인 상태/방 초대 화면은 **미구현**입니다. 디자인 채팅에서는 기능이 배포 전인 경우 "준비 중"으로 구분합니다.

## 검증/배포 경계

- [ ] GitHub Actions lint/typecheck/Vitest(PGlite)/Next Build
- [ ] PR Preview READY
- [ ] 실제 2계정 브라우저 요청→수락→차단·거절 E2E (운영 DB 적용 후)
- [ ] 운영 DB 마이그레이션 기록·RLS/GRANT/Advisor 확인 (사용자 명시 승인 후)

이 문서와 API는 작업 브랜치에서만 검증됩니다. **PR 생성으로 운영 Supabase DB가 자동 변경되지는 않습니다.**
