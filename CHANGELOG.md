# Changelog

Alkkagi Arena의 **코드 병합**, **출시 후보(RC)**, **실제 Production 배포**를 분리합니다. `main`/운영에 없는 변경을 출시 완료로 표시하지 않습니다. [릴리스 프로세스](docs/release-process.md) · [2026-11-03 상태](docs/current-status-2026-11-03.md).

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

- 0.2.0 Production 코드는 배포됐으나 실사용 QA·AI Preview 인증키 문제 및 공식 태그/Release 발행은 별도 인수합니다. 발견된 수정은 후속 버전/핫픽스로 관리합니다.

## 이전 Production 기준점

- 2026-11-03 v0.2.0 병합 **이전** `main` SHA `cd752f6bd335a518302595e2187b54717c9ddaea`, 기존 v0.1.0 계열. 역사적 배포가 확인됐다는 사실은 **공식 `v0.1.0` 태그/Release 발행**과 별도입니다.
- 최초 버전 태그는 실제 배포 성공/인수를 확인한 뒤 생성합니다. 소급 태그 발행 금지.
