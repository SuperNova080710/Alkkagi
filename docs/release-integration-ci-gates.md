# CI R6 — 릴리스 후보 `release/vX.Y.Z → main` 통합 검사 게이트

날짜: 2026-10-30 · GitHub Issue [#188](https://github.com/SuperNova080710/Alkkagi/issues/188) · 릴리스 운영 [#144](https://github.com/SuperNova080710/Alkkagi/issues/144).

## 수정 이유

기존 전용 PostgreSQL17, Supabase local Auth/Realtime, 백업·복원 워크플로는 PR 대상(base)이 `develop` 또는 `release/**`이고 특정 파일 경로가 변경될 때만 실행됐습니다. 하지만 실제 출시 후보는 **`release/vX.Y.Z → main`** PR이며, 앱 코드나 UI만 달라져도 세 가지 E2E가 빠질 수 있었습니다.

세 워크플로 모두 다음 정책을 적용합니다.

| 이벤트/브랜치 | PG17 SQL | Supabase local JWT/Realtime | 백업·복원 | 이유 |
| --- | --- | --- | --- | --- |
| `release/vX.Y.Z → main` PR | 항상 실행 | 항상 실행 | 항상 실행 | 앱 코드만 바뀌어도 출시 전체 통합검증 |
| `chore/ci-*` → `develop` PR | 실행 | 실행 | 실행 | CI 구성 변경 PR의 실제 동작 확인 |
| 기존 개별 작업 `feat/ops-pg17-rollout`, `feat/ops-supabase-local-e2e`, `feat/ops-pg17-restore-drill` push | 해당 SQL/워크플로 파일 변경 시 실행 | 해당 워크플로만 | 해당 워크플로만 | 전용 테스트 작성/수정 중 로컬 확인 |
| 일반 feature push 및 무관한 develop 대상 PR | 실행하지 않음 | 실행하지 않음 | 실행하지 않음 | GitHub Actions 무료 실행량 절감 |
| `workflow_dispatch` | 수동 선택한 브랜치 또는 입력 SHA 검사 | 동일 | 동일 | 특정 `develop`/RC 커밋 재검증 |

세 워크플로의 **`pull_request` 이벤트에 `paths` 필터가 없으며**, 실제 Docker 작업에는 PR의 base/head 조건이 있습니다. `main` 대상의 릴리스 아닌 PR은 해당 Docker job을 `skipped`로 처리할 수 있으므로, 브랜치 보호 설정을 리뷰 담당자가 함께 구성해야 합니다. 이는 **모든 main PR을 자동으로 안전하게 승인**하는 설정이 아닙니다.

`Quality checks`는 기존과 같이 main/develop/release PR 및 해당 브랜치 push를 검증하며 변경하지 않았습니다.

## GitHub Actions 수동 검사

`workflow_dispatch`에서 Ref는 `develop` 또는 실제 `release/vX.Y.Z` 브랜치를 선택합니다. `target_sha`는 선택 사항으로, 해당 브랜치보다 과거의 **정확한 40자리 SHA**를 지정할 때 사용합니다.

예를 들어 GitHub CLI가 로컬에 설치되고 GitHub 인증된 관리자/리포지터리 편집 권한이 있는 경우:

```bash
# Ref 최신 HEAD: develop
gh workflow run pg17-migration-rollout.yml --ref develop

# Ref 최신 HEAD: 실제 RC
gh workflow run supabase-local-e2e.yml --ref release/v0.2.0
gh workflow run pg17-backup-restore.yml --ref release/v0.2.0

# RC 브랜치의 과거 검증 가능 커밋을 명시적으로 재검사
gh workflow run pg17-migration-rollout.yml --ref release/v0.2.0 -f target_sha=0123456789abcdef0123456789abcdef01234567
```

마지막 줄의 SHA는 **입력 예시**이므로 실제 커밋 SHA로 교체해야 합니다.

**유의:** GitHub의 `workflow_dispatch`는 워크플로 파일이 **기본 브랜치에 존재해야** 실행할 수 있습니다. 이번 PR을 `develop`에 병합하는 것만으로 `main` 기본 브랜치에 새 dispatch 정의가 즉시 반영되지 않을 수 있습니다. 최초 버전 릴리스에 CI 정책이 포함돼 main까지 반영됐는지 확인한 후 사용하세요. 배포 전에 RC PR 검증은 자동으로 작동하도록 설계돼 있습니다.

워크플로는 체크아웃 뒤 빌드·npm·Docker 테스트를 시작하기 전에 `scripts/ci/validate-release-target.sh`를 실행합니다. 수동 지정 SHA는 실제 checkout HEAD와 일치해야 하고 `develop` 또는 `release/v*` 히스토리에 속해야 합니다. **pull_request** 검증에는 GitHub가 제공하는 *PR 테스트 병합 커밋*을 그대로 사용하므로 RC 소스만 검사하는 것이 아니라 `main`과 통합된 결과를 검증합니다.

## 반드시 확인할 체크/릴리스 중단 조건

실제 RC PR 화면에서 다음 GitHub Actions job이 모두 `success`인지 확인하고, run 세부정보에 해당 RC의 실제 head/base 또는 PR merge SHA를 기록합니다.

- `Quality checks / check`
- `PostgreSQL 17 full migration rollout / pg17-disposable-integration`
- `Supabase local Auth + Realtime integration E2E / local-supabase`
- `PostgreSQL 17 backup and restore drill / disposable-pg17-restore`

**필수 체크 강제**는 GitHub 저장소의 브랜치 보호 규칙/Ruleset을 변경할 관리자 권한이 필요합니다. 이번 PR은 브랜치 보호를 임의로 수정하지 않습니다. 검토 담당자가 main에 다음을 구성해야 실제로 네 검증의 실패/대기를 병합 차단으로 연결할 수 있습니다.

1. `main` 브랜치에 Pull Request 요구, 필수 상태 체크 4종 등록(이름은 실제 실행 결과 기준).
2. 체크가 현재 head SHA에 유효한지 확인; 예전 HEAD의 성공 결과 재사용 금지.
3. PR 소스가 실제 `release/vX.Y.Z`인지 확인. `main`의 일반 feature/문서 PR은 위 Docker job이 skip될 수 있으므로 병합 정책에서 별도 제한해야 함.
4. 필요한 경우 GitHub 설정에서 merge queue를 사용하면 `merge_group` 이벤트 지원과 검증 비용을 별도로 설계해야 하므로 현재는 사용하지 않음.

## 비용·격리 및 운영 승인과의 관계

- RC→main PR마다 PostgreSQL 17 SQL(약 12분 제한), 로컬 Supabase Auth/Realtime(30분 제한), PG17 백업·복원(15분 제한)이 각각 실행됩니다. 실제 과금은 GitHub Actions 요금/계정 설정과 실행 시간에 따르며 **고정 무료라는 보장은 없습니다**.
- 기존 테스트 Docker는 GitHub 호스팅 일회용 런너. 모두 `permissions: contents: read`, Production URL·Supabase service key/GitHub environment secrets·Vercel 배포를 사용하지 않음.
- SQL/GoTrue/Realtime 테스트 결과가 성공해도 **실제 관리형 Supabase PostgreSQL17.11, 운영 데이터 크기와 백업 RTO/RPO, Production 브라우저 세션·쿠키, 실사용 계정 동시성 E2E를 대체하지 않습니다**.
- 운영 Supabase 004~009 마이그레이션 적용, 실제 운영 DB 백업/복원, Preview·Production 배포, Vercel 환경변수/기능 플래그 변경은 **별도 승인 및 #155/#180 STOP 조건 해제 이후** 처리합니다.

## CI 검증·증빙

- [ ] 이번 `chore/ci-release-gates → develop` PR에서 네 체크 전부 성공.
- [ ] 임시 검증 목적 `release/v* → main` Draft PR에서 세 전용 CI + Quality 체크가 **경로 필터 없이 실제 생성되고 PASS** (실제 정식 릴리스 PR과 구분).
- [ ] 관리자에 의한 `main` Required Checks 설정 여부는 별도로 확인.
- [ ] 실제 Production/관리형 스테이징 E2E는 미수행.

기능 개발 브랜치에서는 **Draft PR까지만** 작성하고 병합하지 않습니다. 릴리스 후보 검증용 임시 브랜치/PR은 정식 배포 목적이 아니며, 검증 후 종료/정리합니다.
