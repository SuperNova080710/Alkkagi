# Alkkagi 운영 2계정 브라우저 E2E — 실행 인수

> **최신 정정 (2026-11-03):** 승인된 두 계정만 접근하는 QA 페이지 구현 PR #198이 develop에 병합됐습니다. SQL 004~009 운영 적용 완료. 그러나 서버 플래그·allowlist·안전한 Preview 배포·실제 브라우저 A/B/DM WebSocket·XP 원장 E2E는 #196/#206 미완료이며 사용자가 별도 승인해야 합니다. [현재 인수](current-status-2026-11-03.md). 아래 오래된 미병합·미적용/미구현 문구는 당시 기록으로 보존합니다.


관련: [운영 DB #155](https://github.com/SuperNova080710/Alkkagi/issues/155), [실사용 검증 #196](https://github.com/SuperNova080710/Alkkagi/issues/196), [Draft PR #198](https://github.com/SuperNova080710/Alkkagi/pull/198).

## 상태와 실행 환경

- 운영 PostgreSQL 17.11의 SQL 004~009는 2026-11-02 적용 완료. **이 도구는 마이그레이션/SQL 관리자 작업을 수행하지 않습니다**.
- 프로젝트 개발자는 로컬 저장소·`.env.local`·Node.js 설치 없이 **Vercel/Supabase 연결 서비스만 사용**합니다. 앞선 로컬 터미널/TTP용 실계정 로그인 스크립트는 PR #198에서 **제거했습니다**.
- 신규 브라우저 QA: `/qa/two-account`, 소스 `src/app/qa/two-account/page.tsx` 및 `src/components/qa/two-account-qa.tsx`.
- 브라우저 QA 경로는 서버 allowlist/기본 OFF 외에도 **Production HTTP `X-Robots-Tag: noindex, nofollow`**와 페이지 robots 메타 태그를 함께 적용합니다. 비색인 설정은 보안 인가를 대체하지 않습니다.
- **현재 운영에서 이 화면을 이용할 수 있다고 주장하지 않습니다.** 새 코드가 배포되지 않았으며, 출시 환경에서 다음 명시적 옵션을 설정하지 않았습니다. 저장소 CI 빌드는 운영 브라우저 E2E의 PASS가 아닙니다.
- 기능 플래그, Vercel Production/Preview 배포, GitHub PR 병합은 **이 문서 작성/PR에서 실행하지 않습니다**. 설정 및 배포는 별도 승인.
- 테스트 사용자 비밀번호, JWT·쿠키·Supabase 비밀키, API 키 값을 Github/채팅/CI/QA 보고에 넣지 않습니다.

## 테스트용 배포가 승인된 경우에만 하는 설정

1. 담당자가 실제 QA 실행할 환경(Production 별도 승인, 또는 격리된 Preview 별도 승인)을 확정하고 **대상 환경이 운영 Supabase 프로젝트에 쓰기를 발생시킨다는 사실**을 확인합니다. 미승인 환경에서는 하지 않습니다.
2. Vercel 대상 배포 환경의 **서버 전용** 환경변수로 `OPS_TWO_ACCOUNT_QA_ENABLED=true` 및 `OPS_TWO_ACCOUNT_QA_USER_IDS=<userA UUID>,<userB UUID>`를 설정합니다. 실제 UUID는 대시보드에서만 입력하고 이슈에 게시하지 않습니다. **서로 다른 올바른 UUID 정확히 두 개**, 순서대로 **A,B** 역할이 확정됩니다. 이 목록에 없는 계정은 404이며, 화면의 QA 요청 대상은 항상 허용된 나머지 한 명으로 **고정**됩니다. 외부 UUID 입력·역할 변경은 제공하지 않습니다.
3. 해당 환경의 `NEXT_PUBLIC_SUPABASE_URL`이 정확히 `https://igjvccohxthmgbfilzxi.supabase.co`로 연결돼 있는지 확인합니다. 다른 프로젝트·누락 설정 시 새 QA 페이지는 **404**를 반환합니다. 공개 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 기존 프론트엔드 Realtime 클라이언트용으로만 사용하며 `service_role`/secret 키는 사용하지 않습니다.
4. QA 페이지는 기존 `FRIENDS_UI_ENABLED`, `MESSAGES_UI_ENABLED`, `COSMETICS_UI_ENABLED`, `ROOM_INVITES_UI_ENABLED`와 독립적으로 동작합니다. 해당 UI 플래그들을 활성화할 필요는 없습니다.
5. 위 **서버 전용 플래그를 켜고 새로 빌드한 배포**에서만 페이지를 이용할 수 있습니다. Vercel 배포 자체는 사용자 별도 승인이 필요한 작업입니다. 환경변수 설정만으로 **이미 실행 중인 기존 Deployment에 기능이 자동으로 나타나지 않는 경우가 있으므로** 정확한 배포의 환경 스냅샷을 확인합니다.
6. 테스트를 마친 뒤 QA 환경 플래그를 다시 비활성화하고, 필요하면 재배포를 통해 공개 표면에서 제외합니다. 자동으로 제거되지는 않습니다.

## 브라우저 A/B 운영 E2E

테스트에는 **기존 사용자 계정 2개(A/B)**가 필요합니다. 시크릿 창 2개 또는 서로 다른 브라우저 프로필로 각기 로그인해 세션을 분리합니다. 비밀번호를 QA 화면에 입력하지 않습니다(기존 서비스 `/login` 사용).

각 브라우저에서 QA URL `https://<승인된-배포-도메인>/qa/two-account`을 열면 서버의 **검증된 A/B 역할과 고정 상대 ID**가 표시됩니다. 서로의 UUID를 직접 입력하지 않습니다. UUID/화면 원본을 공개 이슈나 채팅에 공유하지 않습니다.

### 0. 기본 인증·RLS·XP 기준

- 양쪽에서 **내 Auth·XP 기준 확인**을 **모든 쓰기와 방 생성 이전에** 수행 → 실제 `supabase.auth.getUser`가 서버 사용자와 같고, 내 프로필이 정확히 1개인지 확인. **UTC 시작 시각·누적 XP·UTC 당일 PvP 횟수/같은 상대 일반전 횟수**를 메모리에 고정합니다. 기준값이 없으면 쓰기 버튼과 경기 XP PASS 검증이 차단됩니다. **새로고침 시 기준이 사라지므로 진행 중 다시 누르거나 이미 생성한 방을 재사용해서 PASS 처리하지 마세요.**
- 양쪽에서 **상대 비공개 데이터 차단 확인** → 상대 프로필·코스메틱 인벤토리를 직접 SELECT하면 0행. 비밀값/타인 레코드는 노출되지 않아야 합니다.
- 화면의 **운영 테스트 쓰기 동의** 체크는 명시적인 사용자 동의입니다. 체크 이전에는 모든 쓰기 버튼이 비활성입니다.

### 1. 친구 요청 A→B

- A: 서버에서 확정된 상대 B로만 친구 요청 버튼 한 번 클릭. 기존 친구·이미 대기 중 요청이면 재발송하지 않습니다.
- B: 서버에서 확정된 상대 A의 받은 친구 요청만 수락. `accepted` 또는 기존 친구 상태 확인. 친구 관계는 DB에 남습니다.

### 2. 메시지·Postgres Changes

- B: 먼저 **INSERT 구독 시작**을 누르고 `구독 연결됨` 상태 확인. 이 표시는 채널 연결까지만 증명하며, 메시지 수신을 의미하지 않습니다.
- A: **QA DM 최대 1건 발송** 클릭. A/B 고정 조합에서 결정적으로 만들어지는 `requestId`와 `ALK-QA-...` Marker를 사용합니다. DB의 동일 `(thread,sender,requestId)` 중복 요청은 **기존 메시지를 재사용**하여 새 행을 생성하지 않습니다. 재접속했을 때 동일 Marker를 기존 대화에서 발견하면 **ALREADY EXISTS**로 기록하고 다시 보내지 않습니다. 새 INSERT가 없으므로 이 경우 B Realtime 최초 수신을 PASS 처리할 수 없습니다. Marker와 ID는 B QA 화면에만 전달합니다.
- B: 자신의 WebSocket INSERT 이벤트 목록과 A의 Marker·ID, **GET /api/messages/:peer**의 실제 메시지 조회를 교차 비교한 버튼이 PASS인지 확인합니다. **REST 성공만으로 Realtime PASS 처리 금지**. 수신 실패 시 다시 DM을 대량 발송하지 말고, 구독/RLS 정책을 검토합니다.

### 3. 초대·실제 일반전

- **양쪽에서 기준 Auth·XP 확인이 끝난 후** A: 새 탭에서 **기존 로비**를 열어 일반전 대기방 **딱 한 개**를 생성하고 방 UUID를 A/B 양쪽 QA 화면에 입력. 방 생성시각은 두 계정의 이번 기준 확인시각 이후여야 하며 소유자가 A여야 합니다. 과거 방·다른 계정의 방은 거부합니다.
- A: 기존 `room_players` 직접 SELECT는 RLS로 **본인 좌석 1행만 반환**하므로 두 자리 판정에 사용하지 않습니다. **인증된 방 참가자만 호출 가능한 `get_casual_room(p_room_id)` RPC**에서 `yourSeat=1`, `players[].seat=[1]`을 확인하고 별도의 RLS 허용 `rooms.owner_id=A`, 생성시각 검증을 결합한 뒤 **QA 방 초대 최대 1건** 발송. 발송 전에 `GET /api/room-invites/sent`에서 **B에게 기존 발송된 초대가 있는지 먼저 조회**하므로 accepted/expired/declined 포함 모든 이전 초대에 대해 반복 전송을 차단합니다. B: 5분 TTL 이내에 **초대 수락·seat 2 확인**. 수락한 B의 RPC는 `yourSeat=2`, `players[].seat=[1,2]`를 반환해야 합니다. 기존 참여 시 중복 수락하지 않고 RPC 좌석 검증만 하며, 실제 A=좌석1/B=좌석2가 아니면 실패합니다. RPC는 플레이어의 UUID를 직접 반환하지 않으므로 **방 소유자 A**와 이후 **경기 player1_id=A/player2_id=B**까지 별도로 교차 확인합니다.
- 양쪽 QA 탭은 그대로 열어 두고 **실제 일반전 열기** 링크를 새 탭으로 열어 한 판을 정상 진행·종료합니다. **랭크 RP를 변경하는 랭크전은 사용하지 않습니다**. 관리자 SQL로 경기 결과를 직접 수정하지 않습니다.
- 게임이 정상 `finished` 상태가 되면 A/B QA 탭으로 돌아와 **실제 A/B 경기·XP 원장·누적 검증** 클릭. 단순 room UUID가 아니라 **방 소유자 A·생성시각/경기 생성시각 ≥ 각자의 기준값**, 인증된 참가자 RPC의 `yourSeat`(A=1, B=2)와 `players[].seat=[1,2]`, 경기 `player1_id=A/player2_id=B`·`casual`·승자 A/B/무승부까지 검증해야 합니다.
- 운영 SQL 008은 **UTC 하루 PvP 20회 / 같은 상대 casual 5회** 도달 후 `xp_events.xp_amount=0`을 기록합니다. 두 기준 카운트를 경기 전 확보했으면 **0 XP를 LIMITED(한도 정상 작동)**로 별도 판정하고, XP 지급 성공 PASS와 **구별**합니다. 미달일 때 승자 40/패자 20/무승부 25 XP를 기대합니다. 어느 경우든 이벤트가 각자 **정확히 1행**이어야 하며 누적 XP는 사전 기준 대비 정확히 지급액(한도 시 +0)만큼 변해야 합니다. 기준 미확보·UTC 날짜가 바뀐 경우는 PASS할 수 없습니다.
- A/B에서 **내 기본 코스메틱 생성·장착 확인** 클릭: DB에 starter 아이템/장착 자료를 생성할 수 있으므로 **쓰기 동의 상태에서만** 진행합니다. 기본 알 `piece-classic`을 장착하며, 잠긴 아이템을 우회해 지급하지 않습니다.

### 생성되는 운영 데이터

| 데이터 | 범위 |
| --- | --- |
| Auth 사용자 | 기존 A/B 2개로 로그인, 가입/비밀번호 변경/사용자 삭제 0 |
| `friend_links` | 요청 1, 수락 1(이미 친구라면 추가 없음) |
| `dm_threads`, `dm_messages` | 새 대화 스레드 최대 1, DM **1건** |
| `rooms`, `room_players` | 새 일반전 방 1개, 참가 좌석 2개 |
| `room_friend_invites` | 초대 1건, 수락 상태 변경 |
| `matches`, `shots`, `xp_events`, `player_progress` | 정상 일반전 1판에 필요한 기록·보상 |
| `player_cosmetic_inventory`, `player_cosmetic_loadouts` | A/B 기본 스타터 생성·기본 알 장착 |
| 데이터 정리/차단/추가 방 생성/랭크전/XP 강제 업데이트 | 없음 |
| 운영 SQL 004~009 재실행, Vercel 자동 배포·플래그 변경 | 없음 |

**테스트 중 실패하면 이미 생성된 운영 기록이 남을 수 있습니다.** 자동 재시도·자동 삭제는 하지 않습니다. DM은 A/B 고정 requestId로 중복 쓰기를 제한하고, 초대는 같은 방·상대에 기존 기록이 있으면 거부합니다. 이 상태는 **ALREADY EXISTS**로 표시되며 최초 성공 증빙으로 바꾸지 않습니다. 브라우저 새로고침·새 탭 동시 사용으로 상태를 잃었다면 기존 DB 기록을 먼저 점검하세요. 방을 새로 생성하거나 테스트를 재시작하려면 작업 범위를 재승인받아야 합니다. 004의 생성 한도 5/10을 부하 테스트하지 않습니다.

## 기록과 인수

- 이슈 #155에는 **각 단계 PASS/FAIL**, DB 조회와 일치 여부, **실제 WebSocket INSERT ID와 REST 메시지 ID 동일 여부**, 두 계정의 실제 일반전 종료/XP 유일 지급 여부만 남깁니다. 개인 식별자/원본 본문/토큰/세션/화면 전체/비밀값은 게시하지 않습니다.
- 브라우저 QA 페이지는 테스트 상태를 React 메모리에만 유지하며, 로그인 정보나 실행 결과를 localStorage/서버 로그로 저장하지 않습니다. 페이지 새로고침 시 진행 표시와 XP 기준이 초기화되므로 **진행 중 새로고침하지 마세요**. 중복 실행에 의해 이미 DM/초대가 있으면 ALREADY EXISTS, XP 일일 한도는 LIMITED로 표시하고 모두 최종 새 테스트 PASS로 합산하지 않습니다.
- 운영에서 실제 2계정 흐름이 통과했는지는 **실제 승인된 배포에서 QA 실행 결과가 전달될 때만** PASS로 기록합니다. Github CI 통과는 구현 코드의 회귀를 의미할 뿐 실제 운영 실행 증거는 아닙니다.

## PR 및 배포 정책

- 시스템 채팅에서는 `test/ops-hosted-two-account-e2e` → `develop` Draft PR #198 **작성 및 CI까지만** 진행합니다.
- 리뷰 담당이 PR을 검토/병합하더라도 `develop`은 자동 Production이 아닙니다.
- Preview가 Production DB에 연결돼 있으면 Preview도 운영 쓰기를 수행하므로 **환경별 DB 대상과 승인**이 필요합니다.
- 기능을 출시하는 단계에서 별도 승인한 릴리스 후보 → main 병합/Production 배포 및 서버 QA 플래그 운영 절차를 수행합니다.
