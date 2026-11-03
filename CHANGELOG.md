# Changelog

Alkkagi Arena의 **코드 병합**, **출시 후보(RC)**, **실제 Production 배포**를 분리합니다. `main`/운영에 없는 변경을 출시 완료로 표시하지 않습니다. [릴리스 프로세스](docs/release-process.md) · [2026-11-03 상태](docs/current-status-2026-11-03.md).

## [0.2.0] — Release Candidate (출시 전, 2026-11-03 기준)

> 이 항목은 `release/v0.2.0` **Draft PR [#207](https://github.com/SuperNova080710/Alkkagi/pull/207)**에 포함된 후보 변경입니다. `main` Production 배포, 실사용 E2E 및 정식 `v0.2.0` 태그/Release는 **아직 완료되지 않았습니다**. 실제 RC 기준 문서: [release 브랜치 CHANGELOG](https://github.com/SuperNova080710/Alkkagi/blob/release/v0.2.0/CHANGELOG.md).

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

- RC 브라우저 QA 및 출시 승인 전 발견되는 버그 수정은 해당 `release/v0.2.0`과 `develop`에 동기화합니다. 실제 Production 배포·태그 생성 전에 릴리스 완료 날짜를 넣지 않습니다.

## 기존 Production 기준점

- `main` SHA `cd752f6bd335a518302595e2187b54717c9ddaea`, 기존 v0.1.0 계열. 역사적 배포가 확인됐다는 사실은 **공식 `v0.1.0` 태그/Release 발행**과 별도입니다.
- 최초 버전 태그는 실제 배포 성공/인수를 확인한 뒤 생성합니다. 소급 태그 발행 금지.
