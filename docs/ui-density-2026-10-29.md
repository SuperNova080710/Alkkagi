# Desktop UI density update — 2026-10-29

Issues: #102, #103, #104

## Scope

- Desktop >=1024px: compact navigation/header, hero, mode cards, lobby panels, authentication, waiting room, ranked panels, player search, friends and profile.
- Desktop height-aware sizing (`dvh` + `clamp`), no forced `body` or `main` scroll suppression.
- Ranked dashboard places matchmaking controls beside the leaderboard and history on ordinary desktop heights.
- Profile uses a two-column layout for account information and visibility preferences.
- Leaderboard, match history, player results, and friend lists scroll within their own panel when long.
- Under 680px viewport height, ranked and profile return to linear flow so text remains accessible.
- Game physics, match board, coordinate mapping, API, database, feature flags, and existing mobile breakpoints are outside this change.

## Review and acceptance checklist

- [ ] Browser screenshot review: 1280×720, 1366×768, 1440×900, 1920×1080, default 100% zoom
- [ ] Browser screenshot review: 320px, 390px, 768px widths, and 200% browser zoom
- [ ] Verify the longest nickname, error notices, loading states, 20 player search results, 100 leaderboard rows and friend lists are keyboard reachable
- [ ] Verify profile nickname form and privacy toggle controls remain operable
- [ ] Verify room entry and game board pointer/keyboard coordinates remain unchanged
- [ ] Run lint, TypeScript checking, tests, production build in CI or a connected local environment

## Verification boundary

This environment can review and commit GitHub source files, but cannot clone the repository into its container or run an authenticated browser against the app. Therefore no responsive screenshot, Lighthouse, local lint/typecheck/test/build, or live-game E2E success is claimed here. Request CI and independent PR review before merging. No production/preview deployment or Supabase changes were performed.

## PR 병합 이후 상태 (2026-10-30)

- [PR #109](https://github.com/SuperNova080710/Alkkagi/pull/109) **2026-10-29 main 병합**(`865dd372413789960adff1eb2685c9adc455e8b8`). 브랜치 작성 시 본문 체크리스트가 자동 수행·PASS된 것은 아닙니다.
- 데스크톱 밀도/프로필 2열/내부 목록 스크롤 구현은 저장소에 포함됩니다. **실제 앱 1280×720~1920×1080, 200% 확대, 긴 목록, 미세 페이지 스크롤** 검증은 [#102](https://github.com/SuperNova080710/Alkkagi/issues/102)/[#104](https://github.com/SuperNova080710/Alkkagi/issues/104)에서 별도 추적합니다.
- 이후 로비 카드 간격·열 높이 PR #119/#121과 와이드 히어로 PR #123/#125가 추가 병합돼 **현재 CSS는 이 최초 변경 문서와 다를 수 있습니다**. [최신 인수](current-status-2026-10-30.md)를 우선합니다.
