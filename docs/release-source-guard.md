# Release source guard — main에 릴리스 이외 PR 진입 차단 (#192)

기준: 2026-10-30 · 선행: [#188](https://github.com/SuperNova080710/Alkkagi/issues/188), [#144](https://github.com/SuperNova080710/Alkkagi/issues/144).

## 목적과 정확한 동작

- `.github/workflows/release-source-guard.yml`의 `pull_request` 이벤트에는 **main/develop** 대상만 포함하며 **paths, job-level if, needs 필터가 없습니다**. job 이름은 `release-source-guard`입니다.
- `main` 대상 PR은 **동일한 저장소**의 `release/vMAJOR.MINOR.PATCH` 브랜치에서만 통과합니다(세 자리는 0 또는 0으로 시작하지 않는 십진 정수). `feat/*`, `fix/*`, `release/vfoo`, `release/v0.2.0-rc`, 외부 fork의 동일 이름은 실패합니다.
- `develop` 대상 일반 개발 PR은 통과합니다. 분기·스크립트의 불필요한 리소스 소비를 피하기 위해 checkout, npm 설치, Docker, DB/API 접근, secrets 사용이 없습니다.
- PR head/base/repository 값은 GitHub event 컨텍스트에서 **Bash 환경변수**로 전달합니다. 이벤트 텍스트를 shell script에 직접 삽입하지 않습니다.
- 기존 세 PG17/Supabase 전용 job은 릴리스가 아닌 main PR에서 조건부 `skipped`가 될 수 있습니다. GitHub는 조건부 skip job을 성공으로 볼 수 있으므로 **반드시 guard가 별도 실패해야** 합니다. [GitHub 공식 설명](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 검증

`tests/release-source-guard.test.ts`는 워크플로에 포함된 **실제 Bash 본문 자체를 실행**해 정상 `release/v0.2.0` / `release/v12.34.567`, feat/fix, 불완전한 버전, 접미사, 경로 삽입, 0이 붙은 숫자, fork, develop PR 시나리오의 종료 코드/메시지를 확인합니다. CI Quality에는 기존 Vitest, ESLint, typecheck, Next 빌드가 포함됩니다.

**실제 GitHub main PR 음성 차단, main Ruleset Required 설정은 별도의 관리자 인수 단계**이며, 코드 테스트 성공만으로 검증됐다고 표시하면 안 됩니다.

## 관리자 설정 — 릴리스 STOP 게이트

1. 먼저 #192의 `develop` 대상 PR을 검토/병합합니다. 그 결과를 실제 `release/vX.Y.Z → main` 후보에 포함시키고 **정상/비정상 main PR에서 검사 상태를 검증**합니다. `main`에는 아직 신규 워크플로가 없으므로 현재 저장소 상태에서 본 검사가 모든 main PR에 존재한다고 주장하지 않습니다.
2. GitHub [Ruleset: No-main-push](https://github.com/SuperNova080710/Alkkagi/rules/26007654)의 **Require status checks to pass**에서 이 검사와 기존 네 검사를 **실제 보이는 job 이름/Actions 출처** 기준으로 Required로 설정합니다.
   - `Release source guard / release-source-guard`
   - `Quality checks / check`
   - `PostgreSQL 17 full migration rollout / pg17-disposable-integration`
   - `Supabase local Auth + Realtime integration E2E / local-supabase`
   - `PostgreSQL 17 backup and restore drill / disposable-pg17-restore`
3. Ruleset/Branch Protection 읽기 API는 현재 연결에서 HTTP 403을 반환합니다. **관리자 UI에서 저장된 상태와 실제 PR 차단을 별도로 확인**해야 합니다. `release/vX.Y.Z`가 아닌 PR은 guard가 `failure`이며, 정상 PR만 모두 `success`인지 확인한 뒤 출시를 승인합니다.
4. `main`에 대해 PR 리뷰 필수와 **`.github/workflows/**` 및 릴리스 정책 파일 변경의 독립 검토**를 적용해야 합니다. PR 작성자가 자기 워크플로를 수정해 `success`를 위조하거나 검사 자체를 제거할 수 있다는 **trust boundary** 때문입니다. 단일 작성자의 자기 PR 자기 승인만으로 보안 통제가 완성됐다고 간주할 수 없습니다. CODEOWNERS를 사용할 경우 독립된 실제 승인자가 있어야 하며, 리뷰 없이 모든 관리자가 bypass 가능한 정책도 점검합니다.
5. 보안을 더 강화하려면 **기본 브랜치 정책에서만 실행되는 독립 검사** 또는 서버 측 Ruleset 통제를 추가하는 방안을 검토합니다. 본 구현은 `pull_request` 이벤트 기반이므로 관리형 보호 정책 없이 완전한 위·변조 방지를 보장하지 않습니다. `pull_request_target`은 별도 권한/기본 이벤트 정책 및 보안 위협 검증 없이 임의로 사용하지 않습니다.

## 운영 승인과 무관한 범위

이 PR은 코드 기준 검증/문서만 변경합니다. `main`, Vercel Production/Preview, 운영 Supabase SQL 004~009, 실제 백업/복원, 앱 기능 플래그, 기존 CI Docker 트리거를 수정하지 않습니다. 운영 DB 적용은 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155)의 STOP 조건이 해소된 후 별도 승인으로 수행합니다.
