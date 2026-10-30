# PostgreSQL 17 — 전체 마이그레이션 004~009 일회용 통합 검증

2026-10-30 | 이슈 [#166](https://github.com/SuperNova080710/Alkkagi/issues/166), SQL #168, CI #169, 인계 #170. 운영 읽기 전용 검사 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155) / [Draft PR #161](https://github.com/SuperNova080710/Alkkagi/pull/161). 버전 릴리스 정책 #144.

## 동기와 의미

- Alkkagi 운영 Supabase: **PostgreSQL 17.11** (읽기 전용 조회). 현재 운영에는 004~009가 적용되지 않음.
- 기존 `tests/*-concurrency.sql`는 PostgreSQL **16**을 사용, 기능별 필요한 이주본만 선택해 테스트합니다. 그 자체로 운영 PostgreSQL 17에 모든 migration을 **함께, 실제 순서대로** 적용했을 때의 호환성을 증명하지 못합니다.
- 새 GitHub Actions `PostgreSQL 17 full migration rollout`은 **GitHub Actions 호스트의 임시 postgres:17 컨테이너**에서 초기 P1~P3·AI·프로필 003까지 순서대로 적재하고 004→009를 재생합니다.
- 테스트 통과로 주장할 수 있는 범위는 **격리된 바닐라 PG17 서버의 SQL 및 핵심 권한·경기/XP·레벨/꾸미기 정합성**입니다. 실제 Supabase의 관리형 Auth, 테이블 기존 데이터, 수동 변경/드리프트, 환경별 권한·RLS 데이터 보호, Realtime WebSocket이나 기존 서비스 트래픽을 재현했다는 뜻은 아닙니다.

## 테스트 실행

워크플로: `.github/workflows/pg17-migration-rollout.yml`; SQL: `tests/pg17-migration-rollout.sql`.

워크플로는 **127.0.0.1:5432 / database postgres**의 컨테이너 접속·서버 버전 17.x를 먼저 확인합니다. 합성 고정 UUID 사용자 2명과 `anon`/`authenticated`/`service_role`·`auth.uid()` 스텁, `supabase_realtime` publication을 생성합니다. 별도 DB URL·Secret/Production Supabase 키를 읽지 않습니다.

검사 항목:

1. `202610280001` ~ `202610280010`, `202610290001` ~ `003` **기존 기본 migration 전체 실행**.
2. `202610290004_security_room_create_limits.sql`: 적용 후 **실제 RPC 호출로** 활성 대기방 5개까지 허용, 6번째 `ROOM_ACTIVE_LIMIT` 거부, 기존 방을 닫아도 10분간 생성된 10개를 집계해 11번째 `ROOM_RATE_LIMIT` 거부, 실패 시 방·좌석이 추가되지 않는지 확인.
3. `005_friends_v1.sql`: 친구/차단 데이터 모델과 RPC 생성.
4. `006_direct_messages_v1.sql`: DM 테이블·RPC와 publication 등록.
5. `007_room_friend_invites_v1.sql`: 초대 정책/RPC 생성.
6. `008_xp_levels_v1.sql`: 원장/누적 요약·완료 트리거 설치.
7. `009_cosmetics_v1.sql`: 아이템 카탈로그·인벤토리·장착/RLS/해금 RPC.
8. 후속 **검증 DO 블록**: 신규 테이블 **11개 × 역할 2개(`anon`, `authenticated`) × 쓰기 권한 3개(`INSERT`, `UPDATE`, `DELETE`) = 66개 조합** 전부 검사. RLS ON, 익명 RPC 실행 금지, DM publication 2종, XP 트리거 2개, 스타터 코스메틱 2개도 검사.
9. **음성 권한 테스트**: `xp_events`에 6가지 금지 쓰기 권한을 각각 임시로 부여해 같은 보안 검사기가 **실패하는지** 확인하고 개별 REVOKE. 최종 보안 검사를 다시 통과해야 함.
10. **게임 통합**: 합성 2인 랭크전 2경기 완료(동일 상태 반복 업데이트 포함), 기대값 승자 140 XP·패자 70 XP, 원장 총 4행(중복 없음).
11. **시각 아이템**: 140 XP로 Lv.2 달성 → `avatar-orbit` 해금 → 자기 장착 API 정상 → 다른 계정 RLS 인벤토리 조회 0행, 공개 장착 코드만 조회.

위 음성 테스트는 실제 프로덕션 권한 변경이 아니라 격리된 PostgreSQL 17 CI 컨테이너에서만 수행합니다. 단, SQL의 권한 조회는 **테이블 수준 ACL**만 검사하므로 향후 컬럼 단위 GRANT와 정책 조합을 포함한 종합 보안 감사 및 실제 관리형 환경 테스트를 대체하지 않습니다.

결과는 GitHub Actions 로그의 `PASS PG17` 줄과 종료 코드로 확인합니다. `psql -v ON_ERROR_STOP=1`로 어느 한 단계라도 오류가 나면 즉시 실패합니다. 이 기능은 Production 데이터를 읽거나 바꾸지 않습니다.

## 실제 운영 적용 전 중단 조건

| 단계 | 확인해야 할 조건 | 미달 시 |
|---|---|---|
| 사전 | [#161](https://github.com/SuperNova080710/Alkkagi/pull/161) preflight 운영 catalog/record 일치 | STOP |
| 버전 | 대상 Supabase **17.11**과 신규 통합 PG17 결과 비교 | 호환 이슈 조사 |
| 백업 | 운영 백업/복구 가능 여부·스키마·데이터 보존/복구 계획 확인 | STOP |
| 스테이징 | Supabase와 유사한 격리 환경에서 004~009 순차 적용, 실제 인증/RLS/Realtime·권한 확인 | STOP |
| 사용자 시나리오 | 두 테스트 계정의 친구·메신저·초대·경기 종료·XP·장착 통합 E2E | STOP |
| 운영 승인 | 실제 DDL 적용과 기능 게이트 활성화에 대한 별도 명시적 승인 및 릴리스 리뷰 | 보류 |

**DB 적용은 004→009 순차**, 이미 일부 SQL이 수동 적용된 경우 migration history와 실재 객체를 조정하기 전 반복 실행 금지. PostgreSQL 17 통합 CI 성공은 Supabase 운영 SQL 실행 승인도 아니고 Preview 배포 승인도 아닙니다. `FRIENDS_UI_ENABLED`·`MESSAGES_UI_ENABLED` 등 기능 플래그는 DB 검증 후 별도 승인 전 유지합니다.

## 분업 및 PR 경계

- 시스템 채팅 담당: SQL/PG17 CI/문서 테스트. 변경 파일은 `tests/pg17-migration-rollout.sql`, `.github/workflows/pg17-migration-rollout.yml`, `docs/pg17-migration-rollout.md` **3개 신규 파일만**.
- UI 채팅 담당: 레벨·커스터마이징·메신저·반응형. 이 PR은 `src/components/**`, `src/app/**/page.tsx`, CSS 및 모든 기존 API/기능 SQL을 변경하지 않음.
- #161 preflight는 별도 PR(동일 `develop` base)로 유지하므로 파일 충돌이 없습니다.
- PR 검토/병합 채팅만 `develop` 병합. `main` Production·Vercel Preview·운영 Supabase 프로젝트 변경하지 않음.

## 검증 기록

- [ ] PostgreSQL 17 workflow 결과: 실제 run ID 및 SHA 확인 후 채움.
- [ ] 기존 Quality CI: lint/typecheck/Vitest/Next.js build 통과.
- [ ] Supabase 17.11 스테이징/실계정 E2E: 미수행, 사용자 별도 승인 필수.
- [ ] 운영 DDL·Production 배포: **미수행**.
