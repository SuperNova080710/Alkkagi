# Security S1 — Supabase 보안 경고와 RPC 남용 방어 (2026-10-29)

작업 이슈: [#62](https://github.com/SuperNova080710/Alkkagi/issues/62) · [#63](https://github.com/SuperNova080710/Alkkagi/issues/63) · [#64](https://github.com/SuperNova080710/Alkkagi/issues/64) · [#65](https://github.com/SuperNova080710/Alkkagi/issues/65). 기존 운영 점검 #16.

**적용 구분:** 이 문서는 GitHub 작업 브랜치의 제안 변경을 설명합니다. PR 병합 전 `main`에는 제한 로직이 없으며, 이 문서나 PR 생성만으로 운영 DB에 적용되지 않습니다.

## 점검 근거와 범위

2026-10-29 Supabase 운영 프로젝트에서 Advisor 및 권한 카탈로그를 읽기 전용으로 조회했습니다. 감사 대상 프로젝트 ref는 문서에 노출할 필요가 없으므로 생략합니다. 스키마/GRANT/정책 확인은 `pg_class`, `pg_proc`, `pg_policies`, `has_table_privilege`, `has_function_privilege`를 사용했습니다.

| Advisor | 실제 건수 | 확인 결과 | 대응 |
| --- | ---: | --- | --- |
| `authenticated_security_definer_function_executable` (WARN) | 19 | 인증 사용자에게 명시적으로 노출된 비즈니스 RPC. 단순 경고라고 취약/안전 판단 불가 | 함수별 호출 권한을 감사하고 방 생성 RPC의 남용 가능성을 별도 제한 |
| `rls_enabled_no_policy` (INFO) | 3 | `ranked_queue`, `rematch_votes`, `shot_rate_limits`는 일반 사용자의 직접 접근을 의도적으로 차단 | **정책 추가 안 함**. 현재 deny-all 보존 |
| `auth_leaked_password_protection` (WARN) | 1 | Auth 관리 기능이 비활성화됨 | #65 설정 확인. Pro 이상에서 제공되는 기능이므로 임의로 요금제/설정 변경하지 않음 |

### 실제 PostgreSQL 접근 권한 감사

- `public` 일반 테이블 13개 전체: RLS 활성, `anon` 직접 SELECT 불가, `authenticated` INSERT/UPDATE/DELETE 불가.
- `authenticated` SELECT 허용 테이블 10개는 각자의 SELECT RLS 정책으로 본인/경기 참가자/소유자 데이터만 노출하도록 설계됨. 본 감사는 정책 텍스트와 ACL 확인까지 진행했으며 **실계정 2명 간 E2E 침투 테스트를 수행했다는 뜻은 아닙니다**.
- RLS 정책 없는 3개는 `anon`/`authenticated`가 직접 SELECT/쓰기 모두 불가. RLS의 정책 부재는 기본 거부입니다. Advisor INFO를 없애려고 읽기 정책을 만들면 오히려 노출 위험이 생깁니다.
- 서버 전용 `claim_shot_slot`, `commit_casual_shot`, `forfeit_casual_match`, `expire_match`, `commit_ai_turn`, `forfeit_ai_match`는 `authenticated`/`anon` EXECUTE 없음, `service_role` EXECUTE 있음. `handle_new_user` 트리거 함수는 일반 실행 불가.

### 인증 공개 RPC 19개 분류

아래 RPC는 `anon`에 EXECUTE를 주지 않고 `authenticated`에 EXECUTE를 부여한 **의도된 서비스 계약**입니다. `SECURITY DEFINER`는 기본 RLS를 우회할 수 있으므로 앞으로도 구현의 `auth.uid()` 및 참가자/소유권 검사와 반환 필드에 대한 검토가 필요합니다.

| 기능 | RPC | 감사 관점 |
| --- | --- | --- |
| 초대방/일반전 | `create_casual_room`, `join_casual_room`, `leave_casual_room`, `get_casual_room`, `start_casual_match`, `request_casual_rematch` | 생성자·참가자·방 소유자 검증, 원자적 상태 변경 |
| AI | `start_ai_room` | 호스트만 호출, AI 별도 데이터 |
| 랭크 | `join_ranked_queue`, `ranked_queue_status`, `cancel_ranked_queue`, `ranked_dashboard`, `ranked_match_players` | JWT 사용자 기반 매칭/본인 조회, 경기 참가자별 접근 |
| 경기 채팅 | `send_match_message` | 참가자 여부·길이·1초 재전송 제한 |
| 닉네임 | `check_nickname_available`, `set_my_nickname` | 입력 형식·고유 제약·본인만 변경 |
| 프로필 V1 (#59, 현재 운영 DB 마이그레이션 기록 존재) | `get_my_player_profile_settings`, `get_public_player_profile`, `search_player_profiles`, `set_my_player_profile_settings` | 본인 설정·비공개 검색 제어, 직접 원본 프로필 조회 금지 |

**남아 있는 위험:** 누구나 회원가입할 수 있다면 인증된 사용자가 의도된 RPC도 반복 호출할 수 있습니다. `create_casual_room`에는 애초에 빈도 제한이 없어 대량 `rooms`/`room_players` 삽입이 가능했습니다. 실제 악용 여부나 피해 발생 여부는 확인되지 않았습니다. 관리자 경고만으로 외부 공격 성공을 의미하지도 않습니다.

## #63 — 방 생성 RPC 보강

기존 `public.create_casual_room(text) returns uuid`의 인자/출력/정상 생성 흐름은 유지합니다. **클라이언트 UI와 무관하게 DB RPC 자체에서** 아래 경계를 적용합니다.

1. `auth.uid()` 필수, 기존 8자 영문/숫자 초대 코드 검증.
2. 소유자 `profiles` 행을 `FOR UPDATE`로 잠근 뒤 계산. 잠금 후 `clock_timestamp()` 기준으로 세어 두 개의 동시 생성 요청이 한도를 함께 통과하지 못하게 설계.
3. **동시에 유효한 대기 상태 방 최대 5개**. 초과: `ROOM_ACTIVE_LIMIT`.
4. **최근 10분 내 성공한 방 생성 최대 10개**. 이미 닫힌 방과 시작한 AI/일반전 방도 집계. 초과: `ROOM_RATE_LIMIT`.
5. 익명 EXECUTE 거부, 직접 테이블 쓰기 거부, 다른 사용자 생성 한도와 독립.

일반전 참가·랭크·AI 진행·재대전 정산·닉네임/프로필/게임 보드 로직은 변경하지 않습니다. 단, 반복적인 '새 방 만들기'를 이용하는 빠른 AI 재대전 흐름도 **의도적으로** 위 한도에 포함됩니다. 현행 서버 액션은 한도 예외를 일반적인 '방을 만들 수 없습니다'로 처리합니다. 새 화면/토스트 작업은 UI 채팅과 계약 후 별도 변경합니다.

### 검증 구분

- [ ] PGlite 권한 거부, 대기 방 5개/10분 생성 10개 경계, 사용자 격리, 실패 시 잔여 행 없음
- [ ] 기존 전체 GitHub Actions lint/typecheck/Vitest/Next build 통과
- [ ] Vercel Preview 상태 확인
- [ ] 서로 다른 실제 DB 연결 세션에서 동시 생성 제한 재현 (PGlite 단일 연결 테스트만으로 완료 판단 금지)
- [ ] 사용자가 병합한 이후 운영 마이그레이션 적용 및 운영 검증 (이 대화에서 수행하지 않음)

### PR #69 리뷰 보완: PostgreSQL 동시성 검증

- 별도 PostgreSQL 16 CI 서비스에서 `dblink` 독립 연결 세 개로 실제 경합을 재현하도록 `tests/security-room-concurrency.sql`을 추가했습니다.
- 첫 번째 연결은 미커밋 상태로 `profiles` 잠금을 유지하고, 두 번째 동일 사용자 연결의 `pg_stat_activity.wait_event_type = 'Lock'`을 확인한 후 첫 연결을 커밋합니다.
- 대기방 4개에서의 경합은 정상 생성 1건 + `ROOM_ACTIVE_LIMIT` 1건, 닫힌 방 9개에서의 경합은 정상 생성 1건 + `ROOM_RATE_LIMIT` 1건을 기대합니다.
- 잠금 유지 중 다른 사용자의 생성이 독립 실행되는지 확인하고, 최종 `rooms`/`room_players` 개수로 중복 생성과 부분 행 잔여를 검증합니다.
- 만료된 waiting 방과 10분 이전 생성 이력의 제외 규칙을 추가 검증합니다.
- `.github/workflows/security-room-concurrency.yml`은 GitHub Actions의 폐기 가능한 PostgreSQL 서비스만 사용합니다. 운영 DB나 운영 환경변수는 사용하지 않습니다.

**검증 상태:** 신규 스크립트는 커밋했습니다. GitHub Actions의 실제 결과가 성공하기 전까지 동시성 검증 완료로 판단하지 않습니다. 운영 DB 반영과 PR 병합은 별도 승인 단계로 남습니다.

## 운영 환경 설정 (코드 PR과 독립)

- **유출 비밀번호 차단:** Supabase Auth 관리자 화면에서 실제 지원 요금제·설정을 확인한 후 #65 진행. 공식 안내는 Pro 이상 제공. https://supabase.com/docs/guides/auth/password-security
- **활성화되지 않은 RLS 정책 관련 INFO:** 현재 ACL과 deny-all 설계가 맞으므로 그대로 유지. https://supabase.com/docs/guides/observability/advisors?lint=0008_rls_enabled_no_policy
- **SECURITY DEFINER 경고:** 경고 목록을 무조건 0건으로 만들려고 공개 RPC EXECUTE를 제거하면 정상 게임 기능이 중단됩니다. 함수가 RLS를 우회할 때 필요한 최소 범위와 남용 통제를 계속 검토합니다. https://supabase.com/docs/guides/observability/advisors?lint=0029_authenticated_security_definer_function_executable

## 병렬 개발/병합 경계

- 본 보안 PR은 `main` 출발 독립 브랜치 `feat/security-s1-rpc-guard`에서 개발. 새 마이그레이션·보안 테스트·이 문서만 변경합니다.
- #59/Profile PR #60은 `src/app/api/players/**`, `src/lib/players/**`, `supabase/migrations/202610290003_*.sql` 별도 소유. PR 병합 순서와 무관하게 기존 migration의 적용 이력을 대조해야 합니다.
- UI/UX #51~#56/PR #61 파일과 수정 영역이 겹치지 않습니다. 정보 공유는 GitHub 이슈를 기준으로 합니다.
- PR 작성 뒤 사용자 지시 전까지 병합 및 운영 DB DDL 적용 금지.
