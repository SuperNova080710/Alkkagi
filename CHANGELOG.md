# Changelog

Alkkagi Arena의 **코드 병합**, **출시 후보(RC)**, **실제 Production 배포**를 분리합니다. `main`/운영에 없는 변경을 출시 완료로 표시하지 않습니다. [릴리스 프로세스](docs/release-process.md) · [2026-11-03 상태](docs/current-status-2026-11-03.md).

## [0.4.1] — 정식 배포 승인 (2026-11-09)

- **체스 일반전·랭크전:** 서버에서 승패가 확정되면 오목·체스 AI와 공통 결과 패널을 표시합니다. 재접속·오류 발생 후에도 확정된 결과를 유지하고, 종료 뒤 기물 입력을 차단합니다 (#333).
- **결과 및 이동:** 승리·패배·무승부와 종료 사유(체크메이트, 기권, 시간 초과 등)를 표시하며 일반전은 체스 로비, 랭크전은 체스 랭크 로비로 돌아갑니다. 구현되지 않은 온라인 재대결 버튼은 노출하지 않습니다.
- **검증:** Quality checks, Vitest 95개 파일/571개 테스트, Chromium 5개 화면×모션 설정 2개 조합(10/10) 통과. `release/v0.4.1` Preview READY·사용자 수동 확인 완료.
- **운영:** DB 스키마·RLS·RP 정산·기존 기능 플래그는 변경하지 않습니다. 실제 Production 배포 상태와 SHA는 [릴리스 이슈 #334](https://github.com/SuperNova080710/Alkkagi/issues/334)에 기록합니다. 실계정 2명 온라인 E2E와 공식 Git 태그/Release는 별도 확인 대상입니다.

## [0.4.0] — Production 배포 확인 (2026-11-09)

- 체스 일반전 초대방·대국, 턴당 90초 랭크 매칭과 체스 전용 RP, 세 난이도 AI 연습 대전.
- 알까기·오목·체스 로비 및 랭킹 전환과 공통 레이아웃.
- 새 오목 대국에 흑돌 33·44·장목 금수 적용. 기존 대국은 시작 규칙 유지.
- **배포:** [PR #330](https://github.com/SuperNova080710/Alkkagi/pull/330) `main` 병합(`4658a7ed`) 및 Vercel Production **READY**, `alkkagi-alpha.vercel.app` 별칭 연결 확인. 체스 기능 플래그 활성화. 실계정 두 명의 전체 E2E는 별도입니다.

## [0.3.1] — 오목 랭크전 레이아웃 및 채팅 정책 핫픽스 (2026-11-04)

- **랭크전 화면:** `/omok/ranked/matches/[id]`에서 상단 링크, 경기판, 턴 시간·RP, 하단 푸터의 전체 높이 예산을 조정해 표준 데스크톱의 불필요한 문서 스크롤을 최소화합니다.
- **랭크전 채팅:** 랭크 매치의 채팅 UI/폴링/Realtime 구독을 비활성화하고 채팅 GET/POST API를 인증·RLS 검증 후 403으로 차단합니다. **일반전 채팅은 유지**합니다.
- **품질:** CI 전용 7-뷰포트 Chromium 랭크 경기 fixture 및 채팅 경계 회귀 테스트 추가. 운영용 fixture 라우트는 포함하지 않습니다.
- **운영:** DB 마이그레이션·알까기 판정/RP·오목 엔진과 기존 운영 기능 플래그는 변경하지 않습니다. 정식 Production 배포 결과는 [#298](https://github.com/SuperNova080710/Alkkagi/issues/298)에 기록합니다.

## [0.3.0] — 오목 정식 릴리스 후보 승인 (2026-11-04)

- **출시 범위:** 기존 알까기 유지, 오목 15×15 자유룰, 일반전·AI 3단계·독립 랭크/랭킹, 친구 초대·채팅·재대결, 공통 프로필·레벨·경험치.
- **UI:** 게임별 랭킹 직접 전환, 일반전 대화상자·대기실 공통 디자인, AI 난이도 선택/다시하기, TOP 100 리더보드 가로 스크롤 제거, 반응형 화면 검증.
- **데이터베이스:** Supabase PostgreSQL 17.11 운영에 오목 SQL 001~006 적용 이력 확인. 이미 적용된 SQL을 재실행하지 않습니다.
- **릴리스 관리:** `release/v0.3.0` Preview 사용자 인수 후 2026-11-04 Production 승인을 받았습니다. 실제 운영 배포·도메인·릴리스 SHA는 [#224](https://github.com/SuperNova080710/Alkkagi/issues/224)에서 별도로 확인합니다.
- **검증 경계:** 자동 Quality/Chromium/PG17과 사용자의 Preview 화면 인수는 별도이며, 운영 2계정 Realtime·전체 게임 플레이 E2E는 별도 검증이 필요합니다.

## [0.2.0] — main 코드 병합 및 Production READY (2026-11-03)

> [PR #207](https://github.com/SuperNova080710/Alkkagi/pull/207)은 **`main`에 병합**(`dc5a2f4`)됐고 Vercel Production **READY·서비스 도메인 별칭**을 확인했습니다. 그러나 실제 사용자 A/B·Realtime·AI 및 모바일 E2E, Production Smoke, 공식 `v0.2.0` Git tag/GitHub Release는 **확인되지 않았습니다**. [배포 기록](https://vercel.com/mallang1/alkkagi/4mQ86h7Ed71BAQYT4YLc2Sci2wFr).

### Added
- 친구 요청·차단, 친구 1:1 DM/읽음/Realtime UI, 친구 대전방 초대·수락 및 3D 대기실 (#76/#81/#90/#96/#143/#181).
- XP 원장·레벨·프로필 보상 이력·로비 컴팩트 XP 요약 (#110/#159/#214/#215).
- 알·캐릭터 보유/잠금/장착/6종 인벤토리 및 일반·랭크·AI 게임판 코스메틱 (#115/#167/#173).
- 검색 가이드/FAQ·SEO 메타·사이트맵 (#131/#137).
- QA 보조 화면 #198, Chromium 공개 viewport·UI/SSR 회귀 #197/#200/#202.

### Changed
- `develop` → `release/vX.Y.Z` → `main` 승인 릴리스와 CI 소스·PG17·Supabase·백업복원 검사 (#148/#190/#193).
- PC/모바일 밀도·히어로·초대 터치 영역 등 UI 접근성 개선 (#109/#119/#121/#123/#125/#189/#200).

### Fixed
- 메신저 SQL 응답 계약/에러 폴백 (#202), QA 좌석 조회 RLS 계약 (#198).
- 로비·프로필 '준비 중' 상태가 서버 기능 플래그 ON/OFF를 따르도록 개선, RC #210 및 develop 역반영 #212.
- **아직 미해결:** [#211](https://github.com/SuperNova080710/Alkkagi/issues/211) RC Preview AI 발사/기권 500. Preview 관리자 키 접근 범위 분리와 승인 후 E2E 필요.

### Security / Rollout
- Supabase 운영 PostgreSQL **17.11 SQL 004~009는 2026-11-02 적용 완료** (#155) — **재실행 금지**.
- GitHub CI/일회용 Docker E2E 통과와 실제 두 계정 브라우저 E2E·Realtime·UI 기능 플래그 활성화를 구분. 릴리스 전 #194/#196/#203/#206 게이트.
- 별도 사용자 승인 없이 Preview/Production 키·기능 플래그·운영 데이터를 변경하지 않음.

## [Unreleased]

- 이전 버전의 실사용 2계정 E2E·공식 Git 태그 및 GitHub Release 발행 여부는 개별 릴리스 기록에서 별도 확인합니다. 발견되는 결함은 후속 버전/핫픽스로 관리합니다.

## 이전 Production 기준점

- 2026-11-03 v0.2.0 병합 **이전** `main` SHA `cd752f6bd335a518302595e2187b54717c9ddaea`, 기존 v0.1.0 계열. 역사적 배포가 확인됐다는 사실은 **공식 `v0.1.0` 태그/Release 발행**과 별도입니다.
- 최초 버전 태그는 실제 배포 성공/인수를 확인한 뒤 생성합니다. 소급 태그 발행 금지.
