# PostgreSQL 17 백업·복원 리허설과 운영 릴리스 게이트

2026-10-30 · [상위 이슈 #180](https://github.com/SuperNova080710/Alkkagi/issues/180), 합성 데이터 #182 / CI #183 / 인수 #184.

## 목적 및 분리

운영 Supabase PostgreSQL 17.11에는 아직 친구·DM·초대·XP·꾸미기 마이그레이션 004~009가 적용되지 않았습니다. 이 문서의 테스트는 **GitHub Actions 임시 PostgreSQL 17 Docker 컨테이너**에서만 기존 001~009 SQL을 실행하고, 합성 2계정 데이터를 `pg_dump`으로 백업해 **완전히 다른 빈 데이터베이스**에 `pg_restore`하는 재현 가능한 훈련입니다.

[기존 PG17 전체 적용 검증](../tests/pg17-migration-rollout.sql)과 상호 보완되며, [현재 Production DB 읽기 전용 검사](db-rollout-preflight.md)와는 별개입니다. [PR #178](https://github.com/SuperNova080710/Alkkagi/pull/178)의 실제 Supabase GoTrue/Realtime 로컬 E2E도 독립 작업입니다.

**중요:** 이 CI가 통과해도 실제 Supabase Free 호스팅 DB의 백업이 존재한다거나, 운영 데이터의 무중단 복원·PITR(시점 복구)·백업/복구 허용 시간이 검증됐다는 뜻이 아닙니다.

## 구현 파일과 검증 절차

- `.github/workflows/pg17-backup-restore.yml`: GitHub-hosted `postgres:17` service. `127.0.0.1:5432`만 허용하고 같은 `postgres:17` 이미지의 PG17 `psql`/`pg_dump`/`pg_restore` 클라이언트 사용.
- `tests/pg17-backup-source.sql`: 기존 PG17 전체 SQL·두 가상 사용자·랭크 XP 데이터를 재사용해 **accepted 친구, DM 1개, 초대 pending 1개**를 Auth 역할 RPC로 추가. 복원 전 모든 레코드 확인.
- `tests/pg17-backup-restore-assertions.sql`: 새 DB에 복원 후 **Auth 사용자·프로필·친구 관계·DM·방 초대·XP 원장·아이템/장착 데이터**, RLS·GRANT, DM publication, XP 트리거, 익명 RPC 차단, 사용자별 RLS를 확인. 복원된 RPC로 새 DM 발송(시퀀스 충돌 방지), 방 초대 수락(좌석2), 신규 Auth 등록(프로필 생성 트리거)을 실증.

`pg_dump --format=custom --compress=6`로 논리 아카이브를 만들고 `pg_restore --exit-on-error --single-transaction`으로 원자 복원합니다. **아카이브는 GitHub runner의 임시 디렉터리에만 위치**하며 로그·빌드 Artifact·저장소·외부 저장소로 업로드하지 않습니다. 종료 시 `trap`으로 삭제합니다.

### 재현 결과 표

| 검증 | 기대 결과 |
| --- | --- |
| SQL 001~009 최초 적용 | 모든 migration 성공 |
| 합성 DB 데이터 | 사용자/프로필 2, 친구 1, DM 1, 방 초대 1, XP 이벤트 4 |
| 별도 대상 DB 신규 복원 | `pg_restore --single-transaction` 종료 코드 0 |
| RLS 및 권한 | 친구/DM/초대/XP/꾸미기 RLS ON, `anon` DM 전송 불가, `authenticated` 직접 쓰기 금지 |
| Realtime·서버 기능 | DM publication 2종·XP 트리거 2종 유지 |
| 데이터 생존·계속 작동 | A XP 140·B XP 70, Lv.2 캐릭터 장착 보존, 타인 XP/인벤토리 읽기 0행 |
| 복원 이후 갱신 | B→A DM 신규 작성과 ID 시퀀스 충돌 없음, 초대 수락·두 번째 좌석 반영, Auth 신규 가입 트리거 작동 |

## 진짜 운영 복구를 실행하기 전 필수 조건

1. **백업 확보:** Supabase [Database Backups 공식 문서](https://supabase.com/docs/guides/platform/backups) 기준으로 무료 플랜의 관리형 자동 일일 백업을 보장한다고 가정하지 않습니다. 별도의 **실제 운영 PostgreSQL 백업 방법**이 검증되어야 합니다. 이메일, DM 본문, 인증 레코드 등 개인정보의 백업 보관·접근 제어·암호화 및 삭제 기한도 별도로 정의해야 합니다.
2. **연결·권한:** 관리형 Supabase 데이터베이스에서는 Auth/Storage/Realtime 등 플랫폼 관리 스키마, 소유자, 확장, 논리 복제 및 서비스 키가 엮여 있습니다. **CI의 바닐라 PG17 전체 아카이브를 Supabase Hosted DB에 그대로 pg_restore하는 행동은 금지**합니다. 실제 대상 환경에 맞는 백업 도구/제외 대상/권한을 별도로 검증해야 합니다.
3. **복구 계획:** 운영 중단 시간 목표(RTO), 허용 데이터 손실(RPO), 사용자가 영향을 받는 기능(친구/DM/랭킹/XP/커스터마이징)을 확정하고, 지정된 격리 테스트 환경에서 실제 크기의 백업·복원 속도 및 무결성을 측정해야 합니다. CI가 이 시간을 증명하지는 않습니다.
4. **적용 전 시점:** 004~009 DDL 실행 이전에 **기존 운영 데이터를 안전하게 복원할 수 있는 백업과 복구 권한**을 확인합니다. 복원 실증/기존 데이터 호환 검증이 없다면 릴리스 **STOP**. 예외를 CI 통과만으로 해제하지 않습니다.
5. **릴리스 통제:** 릴리스 #144의 `develop`→RC→`main` 단계를 따르고 운영 변경은 별도 명시적 승인 후 수행. **Vercel 코드 롤백은 Supabase DB 데이터를 되돌리지 않습니다.**
6. **E2E 재검증:** 복원 후 실제 Auth 로그인/세션, 친구·차단, DM Realtime, 초대·재접속, RP/XP 중복 지급, 꾸미기 장착, 비공개/RLS를 실제 관리형 테스트 환경에서 점검합니다.

## 수용 범위 / 미검증

- [ ] 본 PR 최신 HEAD Postgres 17 원본→아카이브→복원 CI 성공
- [ ] Quality Push/PR CI (ESLint, TypeScript, Vitest, Next.js Build) PASS
- [ ] 별도 관리형 Supabase 스테이징에서 실제 기존 데이터 백업/복원, OAuth/Auth 설정, Realtime E2E (미수행)
- [ ] 실제 운영 Free DB의 백업 스냅샷 확보·복원, 운영 DDL 004~009 적용, 기능 플래그 ON (미수행)

사용자 지시대로 **Draft PR 작성까지만 진행**하고, 실제 Production Supabase 데이터·Vercel 배포·Google Search Console을 변경하지 않습니다.
