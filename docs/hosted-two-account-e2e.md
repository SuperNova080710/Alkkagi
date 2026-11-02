# 운영 Supabase 실계정 A/B E2E 실행 인수 — #155 / #196

2026-11-02 · 운영 PostgreSQL 17.11에 004~009 적용 완료 · 사용자 테스트 쓰기 승인: 친구 1 / DM 최소 1 / 방·초대 1 / 일반전 1 / XP 및 기본 코스메틱.

## 작업 상태와 한계

- ✅ 운영 읽기 전용 검증 완료: RLS 24/24, JWT 역할 직접 쓰기 권한 0, RPC anon 실행 0, DM Realtime publication 2개, XP 트리거 2개, 기존 사용자 4개. [#155 상세 결과](https://github.com/SuperNova080710/Alkkagi/issues/155#issuecomment-6566329136).
- ✅ 실제 사용자 비밀번호/세션을 관리자 커넥터가 제공하지 않으므로 **관리자 SQL로 `auth.uid()`를 조작하거나 service-role 경기 데이터를 생성하지 않고**, 기존 A/B 사용자 본인이 로컬 Ubuntu 터미널에서 GoTrue 로그인하는 실행 도구 마련.
- ⬜ **실제 운영 JWT 로그인·WebSocket 수신·일반전 종료·XP 정산은 아직 수행하지 않았음**. 도구 존재 및 GitHub Quality CI가 운영 E2E 성공 증거는 아닙니다.
- 운영 SQL 004~009 재실행/데이터 삭제/기능 플래그 변경/배포/계정 신규 생성 없음.

## 사용자 로컬 준비

1. 프로젝트 저장소의 작업 브랜치 `test/ops-hosted-two-account-e2e`를 사용하세요. 파일 내용은 [E2E 도구](../tests/e2e/hosted-two-account.mjs).
2. Node.js 24, `npm ci`, 기존 `.env.local` 파일에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 있는지 확인하세요. **서비스 역할/비밀 키는 사용하지 않습니다.** URL은 정확히 `https://igjvccohxthmgbfilzxi.supabase.co`만 허용합니다.
3. 이미 가입돼 있고 **두 계정 모두 이메일/비밀번호로 로그인할 수 있는 테스트용 사용자** A/B를 준비하세요. 이메일 인증/비밀번호 재설정/소셜 로그인을 임의로 변경하지 않습니다. 비밀번호·JWT·API 키는 ChatGPT/GitHub/Issue/PR에 전달하지 마세요.
4. `main`/Production Vercel 배포, UI 기능 플래그가 OFF여도 Supabase 사용자 RPC 테스트는 별도로 실행할 수 있습니다. **실제 일반전은 이미 배포된 기존 일반전 UI**에서 진행합니다. Vercel에 새 배포는 발생시키지 않습니다.

### 1단계 — 로그인 A/B 및 최소 데이터 생성

```bash
cd ~/ALEPH/Alkkagi  # 실제 로컬 저장소 경로로 바꿔 주세요
git fetch origin
git switch test/ops-hosted-two-account-e2e
npm ci

# 프로젝트 로컬 .env.local의 URL/publishable key를 사용
node --env-file=.env.local tests/e2e/hosted-two-account.mjs prepare --approved-writes
```

- E2E 프로그램은 터미널에서 계정 A 이메일/비밀번호, 계정 B 이메일/비밀번호를 **에코 없이** 입력 받습니다. 기존 user session은 이 프로그램에만 저장되며 모든 토큰/비밀번호는 파일/Issue/GitHub Actions에 기록되지 않습니다.
- Auth A/B signInWithPassword/getUser 인증 확인 → 본인/타인 프로필 RLS → 익명 친구 RPC 거부 → 친구 요청·수락(이미 친구면 재사용).
- B 실제 사용자 JWT로 `dm_messages` INSERT 구독을 먼저 열고, A가 메시지를 1~최대 3건 전송하며 각 요청의 `id`와 B WebSocket 수신 `id`를 비교합니다. **수신이 없으면 반드시 FAIL**.
- A가 일반전 대기방 1개 및 초대 1개를 만든 뒤 B가 실제 사용자 RPC로 초대를 수락합니다. B 좌석 2 확인.
- A/B `get_my_cosmetics`는 **GET처럼 보이지만 기본 소유 아이템/장착 기록을 쓸 수 있습니다**. A는 기존에 보유한 기본 알을 선택합니다. 타인 인벤토리 조회는 0행이어야 합니다.
- `~/alkkagi-private-e2e/<runId>.json` 파일(권한 0600)에 **이메일/비밀번호/JWT 없이** room ID, A/B 사용자 ID, 검증 전 XP 등만 남깁니다. 이 파일도 GitHub·채팅 업로드 금지. A/B의 다른 브라우저 세션은 해제하지 않도록 로컬 로그아웃을 사용합니다.
- 테스트 중간에 실패하면 이미 생성된 레코드는 **자동 삭제되지 않습니다**. 실패 단계와 생성된 개수만 기록하고, 재시도 시 중복/방 만료를 먼저 확인하세요.

### 2단계 — 실제 일반전 1판

성공 로그에 출력된 URL(`https://alkkagi-alpha.vercel.app/rooms/<roomId>`)을 열고 A/B 각각 독립된 브라우저 프로필 또는 시크릿 창에서 로그인합니다. A는 좌석 1 호스트, B는 좌석 2입니다.

- 방 초대는 5분 TTL이므로 **1단계 실행 직후** 이어서 진행하세요.
- 호스트 A가 정상 일반전을 시작한 뒤 실제 UI에서 한 판을 끝까지 진행하세요(정상 플레이 또는 기존 게임의 정식 몰수 종료). **관리자 SQL로 `matches.status`를 업데이트하면 안 됩니다.**
- **랭크전이 아니라 일반전**만 허용됩니다. 따라서 RP 변화 없음.
- 게임의 모든 샷·결과·경기 기록은 실제 운영 테스트 데이터로 남습니다. 삭제/초기화 없음.

### 3단계 — 경기/XP 정산 결과 확인

```bash
node --env-file=.env.local tests/e2e/hosted-two-account.mjs verify   "$HOME/alkkagi-private-e2e/<runId>.json"
```

- 두 사용자로 다시 본인 인증한 후 해당 `room_id`의 `matches`에서 최종 `finished`·`casual` 여부를 확인합니다.
- A/B XP 원장 `xp_events(source_kind='casual',source_id=<matchId>)`은 각각 **정확히 1행**이어야 합니다.
- 승패 시 승자 **40 XP**, 패자 **20 XP**(무승부 25/25), 지급 전후 누적 XP 최소 증가값 확인. 별도 경기/승패 판정/한도에 따라 다르면 FAIL로 보고 원인 검토.
- 본인/타인 프로필·인벤토리 RLS를 재확인합니다.
- XP/인벤토리/DM을 삭제하지 않으며 상태 JSON도 그대로 남깁니다.

## 운영 쓰기 예상 범위

| 자원 | 최소/최대 | 허용 |
|---|---:|---|
| Auth 기존 계정 로그인 | A/B 로그인, 신규 가입 0 | 승인 |
| `friend_links` | 신규 최대 1행, 기존 accepted면 0 | 승인 |
| `dm_threads`/`dm_messages` | 스레드 최대 1개, 메시지 **1~3개** | 승인 (Realtime 준비 재시도) |
| `rooms`/`room_players` | 방 1개, 좌석 2개 | 승인 |
| `room_friend_invites` | 초대 1개 + 수락 UPDATE | 승인 |
| `matches`/`shots`/`xp_events`/`player_progress` | 일반전 한 판과 정상 종료에 필요한 기록 | 승인 |
| `player_cosmetic_inventory`/`player_cosmetic_loadouts` | 사용자 A/B 기본 보유/장착(기존 상태면 no-op) | 승인 |
| 기존 Auth 계정 신규 생성/삭제·차단·랭크RP·다수 방 생성·004 한도 검증 | 0 | **범위 제외** |
| SQL DDL, 004~009 재실행, feature flags, Vercel 배포 | 0 | **범위 제외** |

## 안전 조건 / 결과 인계

- 스크립트는 `--approved-writes`가 없으면 `prepare`를 실행하지 않습니다. 지정된 **정확한 운영 프로젝트 URL**과 **공개 publishable 또는 anon** 키만 허용하고, 사용자 계정 TTY 인증을 요구합니다.
- 서비스 키·관리자 계정·기존 비밀번호를 리포지터리/환경 로그/CI에 노출하지 않습니다. **운영에서 자동 실행되는 GitHub Action은 생성하지 않았습니다.**
- 실제 운영 결과로 제출할 내용은 PASS/FAIL 단계, 실제 DM WebSocket ID 일치 여부, 수신 시도 횟수, 좌석 2 확인, 경기 완료 여부, 예상 XP 40/20(또는 25/25) 및 원장 1행 여부 **만** 사용합니다. 계정 이메일·사용자 UUID·JWT·비밀번호·DM 본문은 이슈/PR에 붙여넣지 않습니다.
- **테스트 종료 후 DM·방·친구·XP·인벤토리 데이터는 보존**하며, 삭제는 대상/연관성 파악과 별도 승인 이후 진행합니다.
- 실제 실행을 확인할 증빙이 생기면 #155에 실사용 세션/Realtime/대전 정산 PASS 여부를 업데이트합니다. 승인 전 운영 플래그/배포 금지.

## 예상 위험/미검증 범위

- Auth 이메일/비밀번호 방식 아닌 테스트 계정(OAuth 전용)이면 CLI 로그인을 진행할 수 없음. 기존 브라우저 두 계정으로 UI/API 수동 검증을 대체하고 해당 항목은 자동 미검증으로 표기.
- Auth/Realtime은 네트워크·복제 스트림 초기화·접속 제한·계정 설정에 따라 실패할 수 있음. 실제 WebSocket INSERT 수신이 없으면 REST 조회 성공과 관계없이 실패.
- Supabase Free에서 별도 관리형 Staging이나 운영 데이터 백업이 없는 상태. 실패한 E2E의 운영 데이터는 스스로 삭제하지 않음.
- UI feature flags OFF에서는 친구/메신저 화면이 나타나지 않아도 사용자 JWT RPC 검증만 수행할 수 있습니다. 브라우저 일반전 화면의 정상 동작은 별도로 확인해야 합니다.
