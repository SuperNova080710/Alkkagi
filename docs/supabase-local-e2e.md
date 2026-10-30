# 무료 로컬 Supabase Auth·Realtime·RLS 통합 E2E

날짜: 2026-10-30 · 상위 [#174](https://github.com/SuperNova080710/Alkkagi/issues/174) · 하위 #175(환경/CI), #176(사용자 E2E), #177(검증/인수).

## 목적과 안전 경계

기존 PostgreSQL 17 통합 CI([#171](https://github.com/SuperNova080710/Alkkagi/pull/171))는 합성 auth.uid() 및 가짜 역할로 001~009 마이그레이션·트리거·RLS를 검증합니다. 여기서는 **실제 Supabase GoTrue Auth 서버, PostgREST 역할/JWT, Realtime WebSocket**으로 두 계정 흐름을 검증합니다. 다만 **관리형 Production Supabase를 건드리지 않습니다**.

추가 요금을 내거나 Supabase Free 플랜에 새 원격 프로젝트를 만들지 않습니다. GitHub Actions 서버에서 Docker 이미지로 테스트 DB/API를 띄우고, 실패·성공 이후 폐기합니다. Vercel Preview/Production 배포도 생성하지 않습니다.

파일:
- `supabase/config.toml` — 별도 로컬 project id/54321 API/54322 DB, PG17, Auth 이메일 확인 비활성(로컬 테스트 전용)
- `.github/workflows/supabase-local-e2e.yml` — Supabase CLI 2.122.0 / Docker Start / 검사 / Stop
- `tests/e2e/supabase-local.mjs` — 실제 사용자 JWT·Realtime 테스트

### 금지된 실행 경로

CI에서는 **remote project link, login, db push, remote connection URL**을 전혀 사용하지 않습니다. 테스트 스크립트는 환경 변수의 실제 URL을 파싱해 다음과 일치하지 않으면 프로세스를 즉시 종료합니다.

| 항목 | 허용되는 값 |
|---|---|
| `API_URL` | `http://127.0.0.1:54321` |
| `DB_URL` host/port | `127.0.0.1:54322` |
| `DB_URL` dbname | `postgres` |

GitHub Actions 배포 환경/비밀변수에 연결되지 않은 job입니다. 로컬 `supabase status -o env`는 **외부 로그로 출력하지 않고** bash 프로세스 내에서만 읽습니다. 로컬 JWT·service-role 키·가입 이메일/비밀번호는 콘솔에 기록하지 않습니다. 설정은 서비스의 인가 테스트를 위한 합성 자원만 생성하며 종료 시 Docker 볼륨을 삭제합니다.

## E2E 시나리오

1. 실제 Supabase Auth로 신규 사용자 A/B 가입. JWT 발급과 프로필 생성 트리거 확인.
2. A는 자기 프로필 SELECT 가능, B는 A의 프로필 SELECT 불가, anon 공개가 아닌 RPC 금지, 인증 사용자의 직접 친구 테이블 쓰기 금지.
3. A → B 친구 요청 → B 승인, 유효한 accepted 상태 확인.
4. B의 **인증 JWT**로 PostgreSQL `dm_messages` Realtime INSERT 구독. 구독 확인 후 A가 전용 RPC로 DM 전송; B가 메시지 API를 통해 조회하고 실제 WebSocket 이벤트 수신. 20초 이내 수신되지 않으면 실패.
5. A가 일반전 대기방 생성·B에게 방 초대 → B가 수락 → B의 방 참여 좌석 2번 검증.
6. 격리 테스트 DB의 service_role로 합성 랭크전 2경기를 생성·완료. 완료 시 XP 원장 지급: A 140 / B 70, A Lv.2 상승.
7. A가 `get_my_cosmetics`에서 레벨 2 조건의 캐릭터 보유 확인 후 `equip_my_cosmetic` 장착. B는 A의 비공개 인벤토리 SELECT 불가.
8. B가 A 차단 후 A가 새 DM을 보낼 수 없음을 확인.

모든 호출은 반환 `error`를 확인합니다. 실패는 GitHub CI 실패로 이어지며 인증/기밀 값은 에러 설명에 출력하지 않습니다.

## 로컬 실행 (개발 Ubuntu 등)

Docker와 Node.js 24, 설치된 `supabase` CLI 버전 2.122.0 및 프로젝트 npm 패키지가 필요합니다. 원격 Supabase credentials를 환경에 넣지 마세요.

```bash
npm ci
supabase start -x studio,imgproxy,postgres-meta,storage-api,edge-runtime,logflare,vector,supavisor
set -a
source <(supabase status -o env)
set +a
node tests/e2e/supabase-local.mjs
supabase stop --no-backup
```

`supabase stop --no-backup`은 **현재 로컬 프로젝트 데이터**를 삭제하므로 기존 로컬 DB를 보존해야 하는 개발 환경에서는 다른 project_id와 포트를 사용하세요. CI는 매 실행 후 항상 stop으로 정리합니다.

## CI 검사/운영 인수의 구분

| 항목 | E2E 성공 시 증명할 수 있는 것 | 별도로 남는 것 |
|---|---|---|
| Auth/RLS | 실서비스 구조와 유사한 로컬 GoTrue JWT·PostgREST 사용자 접근 정책 | 실제 hosted Auth 설정, OAuth/이메일 제공자, 세션 재발급 |
| Realtime | 로컬 WebSocket Postgres Changes 구독·수신 | 실제 Supabase Free hosted WebSocket 연결/지연/재접속 |
| Migration/게임 | 전체 001~009 로컬 적용 및 합성 경기 정산 | 기존 운영 데이터 migration 충돌·락·백업·복구 |
| 브라우저 | supabase-js 기반 HTTP/WebSocket 흐름 | Next.js 실제 브라우저 로그인/쿠키/모바일/Preview 기능 플래그 |
| 운영 | Supabase/Production/유료 배포 미사용 | 별도 관리형 테스트 환경 승인 및 2계정 수용 시험, 운영 적용 승인 |

**STOP 조건:** 로컬 E2E나 기존 PG17/Quality CI가 실패하거나, 운영 사전 점검 상태와 미적용 파일이 다르면 운영 004~009 SQL 실행 금지. PR 병합 및 첫 v0.1.0 릴리스가 이 조건을 자동 해제하지 않습니다. 
