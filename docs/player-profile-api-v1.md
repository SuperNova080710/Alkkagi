# Player Profile API v1 — backend ⇄ UI/UX integration contract

**Status (2026-10-29):** Backend V1 **merged and deployed to Production** in [PR #60](https://github.com/SuperNova080710/Alkkagi/pull/60) (main commit `8f01c9bd41e80fa3202b33bdecfd5d1cf054ac82`); [CI #40812366995](https://github.com/SuperNova080710/Alkkagi/actions/runs/40812366995) passed and Vercel Production is READY. [Backend #59](https://github.com/SuperNova080710/Alkkagi/issues/59). UI integration belongs to [design #56](https://github.com/SuperNova080710/Alkkagi/issues/56) and is **not yet implemented by this backend PR**. This is the integration contract.

## File ownership / parallel development

- **Backend changes only:** `src/app/api/players/**`, `src/lib/players/**`, `supabase/migrations/202610290003_player_profile_discovery.sql`, `src/proxy.ts` matcher, tests, and this document.
- **UI design chat owns:** `src/app/page.tsx`, `src/app/lobby/page.tsx`, `src/app/profile/page.tsx`, `src/app/ranked/page.tsx`, `src/components/**`, `src/app/globals.css`, `src/app/layout.tsx`.
- This backend PR **does not create** `/players/[id]`, new friend pages or new profile components. Design integration should not alter DB/RPC/API code without coordinating through #59.
- Before integrating, read the **merged** version on `main` and the #59 status. A branch Preview can change during the PR.

## Authentication and response conventions

All endpoints require a valid Supabase Auth session, verified server-side via `auth.getUser()`. No anonymous player directory. Read responses have `Cache-Control: private, no-store` and `Vary: Cookie`.

Success is `{ "data": ... }`. Failures are `{ "error": "CODE" }`.

| HTTP | Path | Query/body | Purpose |
| --- | --- | --- | --- |
| GET | `/api/players/search?q=Ab&limit=10` | `q`: 2–24 chars, `[A-Za-z0-9_가-힣]`; `limit`: optional 1–20, default 10 | Discoverable nicknames, case-insensitive literal substring |
| GET | `/api/players/:id` | UUID (auth user/profile id) | Public player profile; hidden or unknown → 404 |
| GET | `/api/players/me` | none | Authenticated current profile **and** visibility settings |
| PUT | `/api/players/me/settings` | `{"discoverable":true,"showRankedStats":false}` | Change *only own* discovery and ranked-stat settings |

PUT requires `Content-Type: application/json` and a matching request Origin (same-origin browser `fetch` with `credentials: 'same-origin'`). It is not a substitute for existing `set_my_nickname` nickname API.

### Search example

```json
{ "data": [
  {"id":"00000000-0000-0000-0000-000000000011","nickname":"Player_11"},
  {"id":"00000000-0000-0000-0000-000000000012","nickname":"Player_12"}
]}
```

No rating, email, contact list or account metadata in search. Empty search is `{"data":[]}` **only for a valid 2+ character query**; invalid inputs respond 400. `_` is a literal character, not a SQL LIKE wildcard.

### Public profile example

```json
{
  "data": {
    "id":"00000000-0000-0000-0000-000000000011",
    "nickname":"Player_11",
    "isSelf":false,
    "ranked":{"rating":1000,"rank":1,"wins":0,"losses":0,"draws":0,"matches":0}
  }
}
```

`ranked` becomes **null** when another user disables stat sharing. For the owner it is always populated. Rank follows existing leaderboard comparison `rating DESC, id ASC` (all players). This is **real RP** from existing `profiles`, not a new level/XP system.

### Own profile + settings

```json
{"data":{
  "profile":{"id":"00000000-0000-0000-0000-000000000011","nickname":"Player_11","isSelf":true,"ranked":{"rating":1000,"rank":1,"wins":0,"losses":0,"draws":0,"matches":0}},
  "settings":{"discoverable":true,"showRankedStats":true}
}}
```

`PUT` success returns `{"data":{"discoverable":false,"showRankedStats":false}}`.

### HTTP errors

| Code | Meaning |
| --- | --- |
| 401 `AUTH_REQUIRED` | login required (do not show private profile) |
| 400 `INVALID_SEARCH_QUERY` | `q` missing/invalid or `limit` outside 1–20 |
| 400 `INVALID_PLAYER_ID` | non-UUID |
| 404 `PLAYER_NOT_FOUND` | unknown **or** undiscoverable (same response) |
| 400 `INVALID_SETTINGS` | booleans missing/invalid |
| 400 `INVALID_REQUEST` | bad JSON/content type/oversize |
| 403 `ORIGIN_NOT_ALLOWED` | mutation from foreign/missing browser Origin |
| 503 `PROFILE_SERVICE_UNAVAILABLE` | DB/network unavailable, retry or display a neutral error |

## Privacy and existing behavior

1. New `player_profile_settings` is private to its owner by RLS and direct read-only grants. Missing row means `discoverable=true`, `showRankedStats=true` to preserve prior leaderboard/nickname behavior. Settings are saved only through an authenticated RPC with `auth.uid()`.
2. `discoverable=false`: others do not find this player through search and direct profile API returns 404; **owner can still inspect own page**.
3. `showRankedStats=false`: others may find nickname when discoverable but get `ranked:null`; owner still sees rating/wins etc.
4. **Important boundary:** Existing `ranked_dashboard` TOP100, game opponents, turn logs and previous match usernames continue showing nickname/RP as they do now. The profile settings control **the new player-directory APIs only**, **not anonymity in ranked matches**. UI must explain this; don't label as global invisibility.
5. No e-mail, auth metadata, friend list, direct message, level/XP, avatar, marble skin, or user-uploaded file is exposed or implemented here.
6. Avoid preloading another player's `profiles` row directly: `profiles_read_self` RLS only permits self. Instead use these JSON APIs or the underlying explicitly authorized RPCs.

## Integration scenarios

- Nickname list: `fetch('/api/players/search?q='+encodeURIComponent(q))` when trimmed query has >=2 permitted chars.
- Profile detail: `GET /api/players/{id}`; 404 for unknown/private.
- My profile: `GET /api/players/me`; settings switch state with `PUT /api/players/me/settings`.
- Keep existing `/profile` nickname editor and `/ranked` Elo leaderboard; the design chat may integrate these endpoints later.
- Add appropriate UI empty, loading, 401, 400, 404, 503 states, keyboard input debounce (~300ms), and error notice.
- **No fabricated XP/level/season tiers**: future work is tracked in #57.

## Backend acceptance checklist

- [x] Migration applied to Supabase, existing 4 profiles and 22 rating entries preserved, net RP 0.
- [x] PGlite: auth boundary, owner settings, discovery hide, stats hide, wildcard literal, no direct UPDATE, unchanged ranked ratings.
- [x] HTTP input validation and response shape tests, CI lint/typecheck/Vitest/Next build — #40812366995.
- [x] Preview READY, main merge, Production READY. **UI integration and manual browser acceptance remain pending in #56.**

This is the shared integration contract. Both chats should post status/changes to the respective issues and check for overlapping file paths before merging.
