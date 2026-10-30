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

## PR 병합·후속 폰트 변경 (2026-10-30)

- 와이드 히어로 이미지 개선 [#123](https://github.com/SuperNova080710/Alkkagi/pull/123) **main 병합**(`49623b4930019c38c80e8abe728623b6955ee30c`). 해당 문서의 Chromium 수치는 **재구성 모형**의 결과로 실제 앱 스크롤 검증과 구분합니다.
- 이미지가 커진 만큼 제목·eyebrow·tagline을 1600px 이상 와이드 히어로에서 반응형으로 늘리는 [#125](https://github.com/SuperNova080710/Alkkagi/pull/125)도 **main 병합**(`cd5739bf0b33ef52acf9eda6b81a5e366f2d9aa7`). 1920×1080 글꼴 계산값 약 95.2px; 모델 fixture 측정으로는 홈/로비 초과 스크롤 0px. 실제 로그인 앱 측정이 아닙니다.
- 검증 잔여: 실제 Next.js 홈·로그인 로비의 1600×900/1920×900/960/1080, 확대·긴 콘텐츠, 타이틀 잘림/이미지 크롭/헤더·푸터 겹침. [#122](https://github.com/SuperNova080710/Alkkagi/issues/122)·[#124](https://github.com/SuperNova080710/Alkkagi/issues/124) 참조.
