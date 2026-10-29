# Wide hero scroll review — PR #123

## Why the initial change failed review

The source artwork `public/art/hero.webp` is 1920×640 (3:1). The first patch set `max-height: min(48dvh, calc(100dvh - 530px))` for both `/` and `/lobby`. It improved image coverage but incorrectly assumed both routes had the same amount of non-hero content.

The corrected implementation uses a **viewport-sized flex layout** at widths >=1600px and heights >=900px. It sizes the hero from *actual remaining vertical space*, while setting the full-art maximum height from the source image ratio and the 1400px content width (1440px wrapper minus 20px padding on each side). The home and lobby descendants retain their natural heights; exceptionally long content is permitted to scroll. No global overflow suppression or forced image stretching.

## Chromium measurements — reconstructed fixtures, NOT the running application

The fixture was assembled from the GitHub component structure and core layout rules, and run through headless Chromium with viewport CSS pixel sizes and 100% page zoom. These are **independent layout-model checks**; they cannot replace authenticated application screenshots or production E2E.

| Viewport | Home scroll overflow | Lobby scroll overflow | Home hero height | Lobby hero height |
|---|---:|---:|---:|---:|
| 1440×900 | 0px | 0px | existing fixture sizing | existing fixture sizing |
| 1600×900 | 0px | 0px | 353px | 419px |
| 1920×900 | 0px | 0px | 353px | 419px |
| 1920×960 | 0px | 0px | 396px | 458px |
| 1920×1080 | 0px | 0px | 467px | 467px |

For the same reconstructed lobby at 1920×900, adding 30 extra leaderboard rows produced **459px of ordinary document scrolling**, and the hero reduced to its 126px minimum. This checks that overflow is not hidden or artificially forced to zero.

The 1920×1080 fixture has a ~1400px hero content width and a ~466.7px hero height, preserving the 3:1 source aspect ratio; 900px-high windows crop some image height rather than introducing default page scroll.

## Actual-app review required before merging

At **100% browser zoom** and with a normal signed-in user, measure both `/` and `/lobby` using a fresh session in each of these viewport sizes: 1600×900, 1920×900, 1920×960, 1920×1080, 1440×900.

Run in DevTools Console:

```js
({
  width: window.innerWidth,
  height: window.innerHeight,
  route: location.pathname,
  pageOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  heroRect: document.querySelector('.arena-hero')?.getBoundingClientRect().toJSON(),
  footerRect: document.querySelector('.arena-footer')?.getBoundingClientRect().toJSON()
});
```

Capture a full-page screenshot per route/viewport and inspect image edges, headings, cards, footer, and browser zoom. Repeat with leaderboard TOP 3, active matches, long nicknames, and zoom at 200%. **Content that exceeds viewport capacity must remain reachable by scrolling.** Do not report these actual-app acceptance tests as passed until performed.

## Scope

Only `src/app/arena.css` and this review note changed in PR #123. Auth, database, physical game board, animations, server APIs, asset bytes, and mobile layouts were not modified.
