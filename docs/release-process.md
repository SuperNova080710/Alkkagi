# Alkkagi Arena — 브랜치·버전·Preview 릴리스 운영

> **최신 상태 (2026-11-03):** v0.2.0 **PR #207 main 병합**(`dc5a2f4`), Vercel Production **READY 및 서비스 alias 확인**. 실제 두 계정·AI·Realtime/모바일 Smoke와 `v0.2.0` 태그/GitHub Release는 별도 미확인입니다. 운영 SQL 004~009는 2026-11-02 적용 완료되어 재실행하면 안 됩니다. 브라우저 A/B 및 Preview AI 관리자키 #211, 사용자 승인 #203/#206이 남았습니다. [통합 인수](current-status-2026-11-03.md). 아래 본문의 PR 미병합·운영 DB 미적용 문구는 **작성 당시의 기록**입니다.


관련: #144 (상위), #145 (Vercel), #146 (CI), #147 (인수)

## 2026-11-11 운영된 릴리스 사례 및 다음 RC

| 버전 | Release→main | 실제 확인 | 남은 정리 |
| --- | --- | --- | --- |
| 0.2.0 | [#207](https://github.com/SuperNova080710/Alkkagi/pull/207) | 알까기 소셜/XP/꾸미기 통합 | 당시 E2E·공식 태그와 구분 |
| 0.3.0 | [#297](https://github.com/SuperNova080710/Alkkagi/pull/297) | 오목 일반/랭크/AI, 독립 RP·UX Production | 오목 기존 자유룰 대국 보존 |
| 0.3.1 | [#304](https://github.com/SuperNova080710/Alkkagi/pull/304) | 오목 랭크 UI 스크롤·앱 메시지 차단 | DB 직접 RPC/RLS 차단 #342 별도 |
| 0.4.0 | [#330](https://github.com/SuperNova080710/Alkkagi/pull/330) | 체스 3모드·오목 신규 대국 금수, Production READY | 2계정 운영 QA #309/#338 |
| **0.4.1** | [#336](https://github.com/SuperNova080710/Alkkagi/pull/336) | 체스 온라인 종료 결과 패널, `d40e110` Vercel READY | 실계정 A/B Smoke·정식 GitHub Release [#338](https://github.com/SuperNova080710/Alkkagi/issues/338) |
| **0.4.2 후보** | [#345](https://github.com/SuperNova080710/Alkkagi/issues/345) | `develop`의 #342/#343 통합 준비. #344는 아직 PR 미병합 | 신규 SQL 운영 승인·Preview/2인 QA·사용자 main 승인 전 STOP |

**정식 GitHub Releases API 조회(2026-11-11): 0건.** 배포된 소스 버전과 공식 Git 태그·GitHub Release가 동일하다고 단정하지 않습니다. 릴리스 등록/태그를 변경할 때도 담당 채팅의 별도 승인과 SHA 확인이 필요합니다.

### 0.4.2 RC 준비 때 확인할 항목

1. `develop`에 실제 병합된 기능과 **open PR**을 분리. [PR #344](https://github.com/SuperNova080710/Alkkagi/pull/344)는 병합 전에는 `release/v0.4.2`에 포함됐다고 쓰지 않기
2. `20261111025029_omok_ranked_chat_boundary.sql`과 체스 재대결 신규 SQL의 적용 여부를 **운영 SELECT/read-only 이력으로 먼저 확인**. 기존 알까기 004~009·오목 001~006·v0.4.0 금수/체스 SQL 재실행 금지
3. 새 권한과 DB 상태 변경은 보안/RLS/Realtime·Data API 후속 영향, 운영 데이터 보존·복구, 사용자 승인 범위를 문서로 확인 후 적용
4. `release/v0.4.2` RC SHA의 Quality/PG17·Auth/Realtime/Restore/Chromium 검사 및 **별도 승인된 Preview 실제 A/B** 검증 완료. `main` 보호 Required Checks 확인은 #188/#192 후속
5. 사용자 별도 Production 배포 승인 후 `main` 병합 → Vercel READY/동일 SHA·alias → 로그인/게임별 최소 Smoke → `develop` 역반영. 실제 공식 Tag/Release가 없으면 없다고 기록

[상세 v0.4.2 인수](release-v0.4.2-handoff.md) · [전체 이슈 정리](github-issue-audit-2026-11-11.md).

---

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
- **2026-11-03 이전 기준:** `package.json`의 `0.1.0`은 당시 소스 버전 문자열이었습니다. 11월 3일 #207 병합으로 main은 0.2.0 코드를 포함합니다. 이 문서만으로 `v0.1.0` Git 태그나 검증된 릴리스 기록이 생기는 것은 아닙니다.
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

## 운영 정책 병합 후 확인 (2026-10-30)

- PR [#148](https://github.com/SuperNova080710/Alkkagi/pull/148)은 **2026-10-30 main 병합 완료** (`8cf4dc0`). `develop`을 main과 동일 SHA에서 생성했고 조회 시점에도 두 브랜치가 일치했습니다.
- `vercel.json`에는 Git 자동 배포를 `main`만 허용하는 `deploymentEnabled` 규칙이 존재합니다. **실제 Vercel 배포 설정 반영/차단 동작 및 첫 Release Candidate CLI Preview는 확인되지 않았으므로 완료로 단정하지 않습니다.**
- 전환 전 PR #115/#138/#143은 이미 main에 병합된 상태였으므로 base 변경 대상이 아닙니다. **후속 신규 기능 및 문서 PR은 `develop`을 base**로 사용합니다.
- **과거(릴리스 전환 시):** `package.json`의 `0.1.0`은 소스 문자열이었고 당시 정식 `v0.1.0` tag/GitHub Release는 확인되지 않았습니다. 11월 3일 이후 main은 #207의 0.2.0 코드를 포함합니다. `CHANGELOG.md`의 Unreleased 항목도 공식 출시를 뜻하지 않습니다.
- [상위 릴리스 이슈 #144](https://github.com/SuperNova080710/Alkkagi/issues/144)는 운영 정책 실제 동작·첫 RC 검증이 끝날 때까지 열어 둡니다.

## PG17.11 운영 DB 사전 점검·릴리스 STOP 게이트 (2026-10-30)

- [Draft PR #161](https://github.com/SuperNova080710/Alkkagi/pull/161) / [운영 사전점검 문서(아직 PR 브랜치)](https://github.com/SuperNova080710/Alkkagi/blob/feat/ops-db-preflight/docs/db-rollout-preflight.md): 운영 Supabase PostgreSQL **17.11**에서 읽기 전용 68항목 검사. baseline 7 ready, 004 1 inspect(방 생성 제한 미반영), 005~009 60 pending. 실제 객체/이력 기준 004~009 미적용. 작업은 **조회만**, 운영 DDL·데이터 변경 없음.
- 위 점검은 기능을 **배포할 수 있다는 승인**이 아닙니다. 출시에 앞서 004→009 순차 적용 설계와 선행·후행 API 호환성, 백업/복구, 테이블/RLS/GRANT/Realtime, PG17 실제 스테이징 및 2계정 E2E를 확인해야 합니다. PG16 기반 과거 동시성 CI와 PG17 운영 실증을 구분합니다.
- [XP UI PR #159](https://github.com/SuperNova080710/Alkkagi/pull/159)는 **`develop`에 Squash 병합** (`f6cb2e9`)됐으며 `main`에는 아직 미포함입니다. `EXPERIENCE_UI_ENABLED` 기본 OFF. 코스메틱 UI는 #162~#165 작업 중. 운영 SQL 008/009 적용·실사용 확인 전 일반 기능으로 노출하지 않습니다.
- 2026-10-30 과거 Production SHA `8cf4dc0`의 READY 상태는 #161 조사 기록에 있으나 **실 HTTP/사용자 E2E·Vercel 배포 제한 정책 검증을 대신하지 않습니다**. 첫 `release/vX.Y.Z` 수동 CLI Preview와 공식 버전 태그도 별도입니다.
- **과거 기록 정정:** PR #161은 이후 `develop`에 병합됐으며, 당시 Draft·미병합 표현은 작성 시점 기록입니다. 신규 검사 도구의 main 포함 여부는 현재 릴리스 소스로 확인하세요. 운영 환경에서 임의 DDL을 실행하지 않습니다.
