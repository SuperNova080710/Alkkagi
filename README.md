# Alkkagi Arena

**브라우저에서 즐기는 1:1 온라인 보드게임 서비스 — 알까기 · 오목 · 체스**

친구와 코드로 방에 참여하거나 게임별 랭크전·AI 대전을 즐길 수 있습니다. Supabase Auth·PostgreSQL·Realtime 기반으로 사용자와 경기 정보를 관리하고 Next.js를 Vercel에 배포합니다.

[<u>서비스 바로가기</u>](https://alkkagi-alpha.vercel.app) · [전체 개발·운영 상태 (2026-11-11)](docs/current-status-2026-11-11.md) · [이슈 전수 감사](docs/github-issue-audit-2026-11-11.md) · [릴리스 변경 내역](CHANGELOG.md)

> **운영 기준 (2026-11-11): v0.4.1 Production.** GitHub `main` = `d40e1101c32bb30143ca9728a248860376093d45`, Vercel [Production 배포](https://vercel.com/mallang1/alkkagi/9iKVkDCnu7bmuEaHqE9wotiPD2Kr) **READY**·`alkkagi-alpha.vercel.app` alias 일치. 로그인된 두 계정의 전체 E2E·공식 GitHub Release는 별도 운영 인수 중입니다. 최근 수정 PR이 `develop`에 병합됐다고 자동으로 Production에 표시되는 것은 아닙니다.

## 지금 제공하는 게임

| 게임 | 일반전 | 랭크전 | AI 대전 | 특이사항 |
| --- | --- | --- | --- | --- |
| **알까기** | 1:1 방 생성·코드 참가·친구 초대, 서버 확정 턴·물리 | 랜덤 매칭·RP·리더보드 | 난이도 선택·연습 대전 | 재대결, 경기 채팅, 알/캐릭터 꾸미기, 레벨/XP |
| **오목** | 15×15, 친구 초대·채팅·재대결 | 오목 전용 RP·리더보드·매칭 | 3개 난이도 | **v0.4.0부터 신규 대국** 흑 33·44·장목 금수. 이전 시작 대국은 자유룰 유지 |
| **체스** | 코드방·친구 초대·합법 수 서버 판정 | 턴당 90초·체스 독립 RP | 3개 난이도·즉시 재시작 | 기물 이동 모션·차례 배너·승패/무승부/종료 사유 결과 패널 |

게임별 랭크 등급·RP·전적은 분리하고, 사용자 프로필·친구·메신저·XP 등은 공통 경험으로 연결합니다. 자세한 동작은 실제 구현/릴리스와 [공개 조작법](https://alkkagi-alpha.vercel.app/how-to-play)을 대조해야 합니다.

### 접속 경로

- [게임 선택·로그인](https://alkkagi-alpha.vercel.app) · [알까기 로비](https://alkkagi-alpha.vercel.app/lobby) · [알까기 랭크](https://alkkagi-alpha.vercel.app/ranked)
- [오목 로비](https://alkkagi-alpha.vercel.app/omok) · [오목 랭크](https://alkkagi-alpha.vercel.app/omok/ranked)
- [체스 로비](https://alkkagi-alpha.vercel.app/chess) · [체스 랭크](https://alkkagi-alpha.vercel.app/chess/ranked)
- [프로필](https://alkkagi-alpha.vercel.app/profile) · [친구](https://alkkagi-alpha.vercel.app/friends) · [메신저](https://alkkagi-alpha.vercel.app/messages) · [꾸미기](https://alkkagi-alpha.vercel.app/cosmetics)

일부 경로는 인증/서버 기능 플래그를 요구합니다. 직접 링크 존재가 모든 계정에 기능이 열린다는 뜻은 아닙니다.

## 현재 진행 중인 개발 — v0.4.2

**아직 Production에 적용되지 않은 작업**입니다. 릴리스 트래커는 [#345](https://github.com/SuperNova080710/Alkkagi/issues/345), 운영 인수는 [v0.4.2 체크리스트](docs/release-v0.4.2-handoff.md)를 따릅니다.

- **[#342](https://github.com/SuperNova080710/Alkkagi/pull/342) (develop 병합)** 오목 랭크 메시지 직접 RPC INSERT/SELECT DB 경계 차단. 신규 SQL은 **운영 미적용**, 앱 API 수준 채팅 차단(v0.3.1)과 구분
- **[#343](https://github.com/SuperNova080710/Alkkagi/pull/343) (develop 병합)** 공개 가이드의 게임별 AI 진입 방식·중복 페이지 제목 정정. v0.4.1 Production에는 미포함
- **[#344](https://github.com/SuperNova080710/Alkkagi/pull/344) (미병합)** 체스 일반전 종료 후 양쪽 수락 재대결 ([#341](https://github.com/SuperNova080710/Alkkagi/issues/341)); 신규 SQL·실제 두 계정 QA·릴리스 전 승인 필요
- **후속 별도:** 체스 일반전 대국 채팅 [#340](https://github.com/SuperNova080710/Alkkagi/issues/340), 체스 온라인 서버 확정 XP [#339](https://github.com/SuperNova080710/Alkkagi/issues/339), 오목 돌/체스 기물 꾸미기 [#323](https://github.com/SuperNova080710/Alkkagi/issues/323). **이미 출시된 기능으로 표시하지 않음**

## 기술 구조

| 영역 | 구성·계약 |
| --- | --- |
| UI | Next.js App Router · React · TypeScript · Tailwind CSS |
| 게임 판정 | 알까기 독립 물리 엔진, 오목 서버 권위 착수·결과, 체스 `chess.js` 기반 합법 수·서버 온라인 대국 판정 |
| 인증·실시간 | Supabase Auth · PostgreSQL 17.11 · RLS/RPC · Realtime + DB 확정 스냅샷 재조회 |
| 배포 | GitHub `main` → Vercel Production; `develop` 작업 통합; `release/vX.Y.Z` 검토/수동 Preview |
| 품질 | GitHub Actions Quality, PostgreSQL 17 SQL·RLS/권한·경합, Supabase local Auth/Realtime, 백업복원, Chromium 뷰포트 회귀 |

개발 설정/스크립트의 진실의 원천은 [package.json](package.json)과 [.github/workflows](.github/workflows)입니다. `npm run check`는 lint → typecheck → Vitest → Next.js production build를 검증합니다. CI 통과와 Production에 실제 두 사용자로 접속한 E2E는 다릅니다.

### 운영 데이터·보안 원칙

- 과거 적용된 알까기 SQL 004~009, 오목 001~006 및 v0.4.0 오목 금수/체스 SQL은 릴리스 이력이 있습니다. **기존 마이그레이션 재실행 금지**. 새 SQL은 운영 적용 여부·RLS/GRANT·Realtime·백업/복구·기능 호환성 확인 후 승인된 범위만 진행합니다.
- Vercel·Supabase 서비스 관리자 키는 서버 전용이며 브라우저 코드/PR/이슈에 게시하지 않습니다. Preview와 Production의 DB/키 범위를 구분합니다.
- 운영에서 아직 검증되지 않은 부분은 [#338](https://github.com/SuperNova080710/Alkkagi/issues/338) 실제 v0.4.1 두 계정 Smoke·태그/Release, [#309](https://github.com/SuperNova080710/Alkkagi/issues/309) 체스 QA, [#194](https://github.com/SuperNova080710/Alkkagi/issues/194) UI, [#196](https://github.com/SuperNova080710/Alkkagi/issues/196) Auth/DM/XP, [#62](https://github.com/SuperNova080710/Alkkagi/issues/62)·[#65](https://github.com/SuperNova080710/Alkkagi/issues/65) 보안 인수에서 별도 추적합니다.
- GitHub Releases API에 정식 Release 등록이 확인되지 않았습니다. 버전이 배포됐다는 이유로 태그와 Release가 발행됐다고 기록하지 않습니다.

## 브랜치·이슈·PR 운영

1. 큰 기능은 상위 이슈, 시작 가능한 세부 작업은 하위 이슈로 분리합니다.
2. `develop`에서 기능별 `feat/<issue>-...`, `fix/<issue>-...`, `docs/<issue>-...` 브랜치를 생성하고 검증 가능한 단위로 커밋합니다. 커밋 메시지는 제목 한 줄, 빈 줄, 변경 근거 3~4개 불릿을 사용합니다.
3. 기능 PR은 `develop`, 릴리스 후보는 `release/vX.Y.Z → main`으로 구분합니다. **검토/병합은 별도 담당 채팅**에서 수행합니다.
4. 합쳐진 PR의 구현 이슈는 근거 PR·출시 범위를 남기고 종료하되, 운영 E2E·보안·미출시 기능의 남은 작업은 별도 OPEN 상태로 유지합니다.

[릴리스 운영 절차](docs/release-process.md) · [v0.4.1 최신 인수](docs/current-status-2026-11-11.md) · [전체 GitHub 이슈 정리](docs/github-issue-audit-2026-11-11.md)

## ALEPH 이전 제출·역사적 문서

ALEPH P1/P2/P3 제출용 기준점은 현재 v0.4.1 기능 범위와 다릅니다. 2026-10-28/29 제출 스냅샷·기존 게임/디자인 설계는 원본 그대로 유지합니다. [ALEPH 제출 문서 색인](docs/aleph-submissions.md) · [2026-11-03 상태 기록](docs/current-status-2026-11-03.md). 실제 ALEPH 플랫폼 최종 접수·승인은 별도 이슈 [#3](https://github.com/SuperNova080710/Alkkagi/issues/3)에서 확인합니다.
