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
