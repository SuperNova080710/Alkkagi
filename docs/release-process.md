# Alkkagi Arena — 브랜치·버전·Preview 릴리스 운영

관련: #144 (상위), #145 (Vercel), #146 (CI), #147 (인수)

## 원칙

| 브랜치 | 목적 | 병합 대상 | Vercel 배포 |
| --- | --- | --- | --- |
| `main` | 운영 확정 코드 | 없음 | Git Push 시 Production |
| `develop` | 기능 통합 | `release/vX.Y.Z` 분기 기준 | Git Push 자동 배포 안 함 |
| `feat/<issue>-...` / `fix/<issue>-...` | 개별 변경 | `develop` | Git Push 자동 배포 안 함 |
| `release/vX.Y.Z` | 출시 후보 고정 및 승인 전 회귀 | `main` PR, 수정분을 `develop`에도 재통합 | **수동 CLI Preview만** |
| `hotfix/vX.Y.Z` | 긴급 운영 수정 | `main`, 이후 `develop` 역반영 | 릴리스 승인 정책 별도 적용 |

각 큰 작업은 상위 이슈, 구현 가능한 작은 단위는 하위 이슈. 작업별 브랜치·커밋·PR을 사용합니다. 시스템과 디자인 담당자는 PR까지만 작성하고 병합은 기존 PR 검토 채팅에서 합니다.

## 전환·초기 버전 원칙

- 도입 전 `main`의 기존 코드와 운영 Production 배포 기록은 그대로 유지합니다.
- 이번 정책 전환 PR은 부트스트랩 예외로 `main` 대상으로 생성됩니다. **병합 이후** 진행 중 PR의 base를 `develop`으로 조정할 수 있습니다. Base 변경 시 diff/필수 CI 결과를 확인합니다.
- `package.json`의 `0.1.0`은 현재 소스 버전 문자열입니다. 이 문서만으로 `v0.1.0` Git 태그나 검증된 릴리스 기록이 생기는 것은 아닙니다.
- 첫 공식 버전 번호는 공개 기능·DB migration·실제 QA·릴리스 범위를 토대로 결정하고 승인 후 태깅합니다.

## 배포 비용 제어

`vercel.json`의 `git.deploymentEnabled`는 자동 Git 배포를 `main`에만 허용합니다. 이 설정은 실제 Production에서 적용되기 **전**까지는 현행 Vercel Git Preview 트리거가 유지될 수 있습니다. 정책 적용을 검증하기 위해 일부러 시험 배포를 남발하지 않습니다.

`Ignored Build Step`에서 빌드를 취소하는 방식은 배포 생성 자체를 막지 못하므로 비용 제한의 기본 수단으로 사용하지 않습니다.

CI를 통과한 릴리스 후보를 확정하고 Preview 환경/쿼터를 확인한 뒤, 프로젝트를 로컬 Vercel에 올바르게 연결한 상태에서 `release/vX.Y.Z`를 체크아웃해 다음을 수동 실행합니다.

```bash
git switch release/vX.Y.Z
git pull --ff-only origin release/vX.Y.Z
git status --short
# 브랜치, 연결된 Vercel 프로젝트, 환경 변수/Quota 확인
vercel deploy
```

- `vercel deploy`는 기본적으로 Preview입니다. `--prod`는 사용하지 않습니다.
- CLI Preview가 배포 정책 적용 후에도 정상 생성되는지 첫 RC에서 검증합니다. 배포 한도가 소진되었으면 생략하고 차기 허용 시점에 검증합니다.
- 가능하면 RC Preview 1회, 수정 시 재검증 1회를 목표로 하되 품질 기준보다 횟수를 우선하지 않습니다.
- 모든 검토 PR·feature Push는 GitHub Actions로 우선 검증합니다.

## RC 검증 체크리스트

- [ ] `npm ci`, `npm run check` / quality CI 통과
- [ ] PostgreSQL 동시성 회귀 테스트 (변경 경로 해당 시) 통과
- [ ] Release 브랜치의 SHA, 주요 포함 PR, DB migration을 기록
- [ ] Preview용 Supabase Auth/DB/Realtime과 운영 환경 간 분리 여부 확인
- [ ] Preview에서 실사용 2계정 로그인·세션·로비·일반/랭크 방·게임 종료·재접속 테스트
- [ ] 친구/DM/초대·성장·꾸미기 등 릴리스에 포함된 기능에 한하여 권한/Realtime 테스트
- [ ] 접근성, 반응형, 주요 브라우저·모바일 점검
- [ ] 익명/타 사용자 접근, RLS, 서버 권한, Rate limit 확인
- [ ] DB 마이그레이션이 기존 Production 코드와 호환되는지 확인
- [ ] 최종 PR 리뷰 승인 및 변경 범위 고정

**주의:** Preview에서 Production Supabase를 직접 변경하지 않습니다. Preview용 DB가 아직 없다면 DB 쓰기가 발생하는 E2E는 수행하지 않고 환경을 분리할 때까지 보류합니다. 운영 DB migration은 코드 PR 병합과 별도 승인 및 사전 호환성 검증 후 적용합니다.

## 릴리스 및 복구

1. RC 합격 결과, URL, 테스트 환경, 테스트 계정(실제 비밀값 제외), SHA를 PR에 기록합니다.
2. `release/vX.Y.Z` → `main` PR 병합은 **별도 검토/병합 담당**이 진행합니다.
3. Production 자동 배포 성공 확인. 운영 로그인/게임 생성/멀티플레이 최소 Smoke Test 실시.
4. 배포 성공한 실제 `main` 커밋에 `vX.Y.Z` 태그 및 GitHub Release 작성. `CHANGELOG.md` 갱신.
5. 릴리스 후보에서 수정한 내용을 `develop`에 반드시 반영하고 RC 브랜치를 삭제합니다.
6. 장애 시 Vercel 이전 Production 배포로 롤백하는 방법을 검토합니다. **DB 스키마·데이터는 Vercel 롤백으로 되돌아가지 않습니다.** 따라서 DB 변경은 사전 백업/전방 호환·복구 계획이 필수입니다.

Preview 배포에서 동일 코드가 통과해도 Production에는 환경변수/빌드 차이가 있을 수 있으므로, Production Smoke Test를 생략하지 않습니다.

## 담당자 협업

- 시스템: API/DB/보안/Realtime 변경과 자동 테스트
- UI: 화면, 반응형, 상호작용, 접근성
- 문서/운영: 변경내역·릴리스 체크리스트·실제 RC 결과
- 리뷰 담당: 리뷰/병합만, 미검증 상태에서 `main` 병합 금지

브랜치 정책 반영 시점에는 PR #115(코스메틱)·#138(문서)·#143(메신저 UI)가 이미 `main`에 병합됐습니다. 따라서 이 PR들의 base를 변경하지 않습니다. 정책 병합 후 `develop`을 새 `main`으로 동기화하여 후속 기능 PR을 `develop` 기준으로 작성하고, 변경된 브랜치 정책의 CI를 확인합니다.
