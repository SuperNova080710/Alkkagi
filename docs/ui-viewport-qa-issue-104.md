# Issue #104 — 전체화면 · 확대 · 모바일 UI 검증 인수

기준: `develop` (2026-10-30), 연관 상위 #102, 기존 밀도 변경 PR #109·#119·#121·#123·#125·#181.

## 코드 검토에서 발견한 반응형 위험과 변경

1. **짧은 와이드(1600px+, 높이 900~999px)**: 기존 `@media(min-width:1600px,min-height:900px)` 하단에서 모든 배너에 공통 `min-height:clamp(270px,30dvh,320px)`를 지정해, 앞서 정의한 로비 compact 배너의 `126px` 최소 높이를 덮고 있었습니다. 긴 랭킹/복구 영역이 있을 때 하단이 밀릴 수 있는 구조입니다. 새 조건은 짧은 와이드에만 홈 `244px`, 로비 `220px` 최소 높이와 이에 맞는 글자 크기를 지정합니다. **높이 1000px 이상 큰 배너 디자인은 변경하지 않습니다.**
2. **중간 폭(640~1023px, 확대된 데스크톱 포함)**: 기존 내비게이션이 줄바꿈 없이 여섯 메뉴+계정 버튼을 배치할 수 있었습니다. 명시적 `flex-wrap`, 줄 간격 및 최소 너비 0을 사용해 내용 폭을 넘지 않도록 보완했습니다.
3. **작은 모바일(320~360px 및 더 좁은 CSS 폭)**: 배너 제목의 고정 `49px`, 모드 이미지의 고정 `96px`이 좁은 폭에서 크게 보일 수 있었습니다. 제목 `clamp`, 모드 이미지 `72px`, 하단 두 버튼 1열로 조정합니다.
4. **스크롤 정책**: `body`, `.arena`, `.arena-wrap`에 `overflow:hidden`을 추가하지 않았습니다. CSS `zoom`/`transform:scale()`로 축소하지 않습니다. 진짜 긴 목록·높이 부족·200% 확대에서는 **세로 스크롤을 허용**합니다. 스크롤바를 강제로 숨겨서 통과했다고 판단하면 안 됩니다.
5. **게임 로직 불변**: `globals.css`의 게임판 `100dvh`, 800×500 SVG/viewBox, `RADIUS`, 포인터·키보드·Shot/Board·Realtime 코드는 수정하지 않았습니다.

## 자동 테스트와 한계

`tests/ui-viewport-contract.test.tsx`는 장문 닉네임, 진행 경기 10개, 랭킹 TOP3, 홈/로비 시맨틱 구조, 데스크톱/모바일 분기와 게임판 CSS 불변을 확인합니다. **정적 SSR·CSS 계약 테스트이며 픽셀 위치·스크린샷 또는 실제 인증 페이지 E2E가 아닙니다.**

아래 실제 브라우저 검증 표를 실행하기 전까지 Issue #104의 **시각 실측 수용 기준은 미충족**입니다. Vercel 한도 문제 때문에 수동 Preview/Production을 새로 생성하지 않았습니다.

## 실제 브라우저 검증 매트릭스

| 화면 | 1280×720 | 1366×768 | 1440×900 | 1920×900 | 1920×960 | 1920×1080 | 320×720 | 390×844 | 768×1024 | 200% |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` 로그인 전 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 |
| `/lobby` 로그인 후 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 |
| `/ranked`, `/profile` | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 |
| `/players`, `/friends` | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 |
| 일반전 호스트/게스트 대기실 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 |
| 일반·랭크·AI 경기 중 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 | 미실시 |

`200%`는 가령 물리 화면 1920×1080을 Chrome Zoom 200%로 맞추고 **CSS viewport** (`window.innerWidth/innerHeight`)를 함께 기록해야 합니다. 모바일은 DevTools 디바이스 모드로 전환하여 별도로 확인하세요. 모의 데이터(긴 닉네임·100위 랭킹·20명 검색 결과·친구 목록·로딩/오류 상태)에서도 화면 스크롤이 아닌 **목록 자체 스크롤**로 마지막 항목에 도달하는지 확인합니다.

### DevTools 측정 스크립트

각 화면과 크기를 맞춘 뒤 Chrome 개발자 도구 Console에서 실행합니다. 결과를 이슈에 붙이고 해당 스크린샷의 viewport/zoom을 함께 적습니다.

```js
(() => {
  const root = document.documentElement;
  const doc = document.body;
  const pageWidth = Math.max(root.scrollWidth, doc.scrollWidth);
  const pageHeight = Math.max(root.scrollHeight, doc.scrollHeight);
  const widthOverflow = Math.max(0, pageWidth - root.clientWidth);
  const heightOverflow = Math.max(0, pageHeight - root.clientHeight);
  const outOfBounds = [...document.querySelectorAll('body *')]
    .filter(el => {
      const box = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      return styles.position !== 'fixed' &&
        (box.right > root.clientWidth + 1 || box.left < -1) &&
        box.width > 0 && box.height > 0;
    })
    .slice(0, 15)
    .map(el => ({
      element: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      rect: JSON.stringify({
        left: Math.round(el.getBoundingClientRect().left),
        right: Math.round(el.getBoundingClientRect().right),
      }),
    }));
  const localScrolls = [...document.querySelectorAll('main *')]
    .filter(el => {
      const c = getComputedStyle(el);
      return el.scrollHeight > el.clientHeight + 1 &&
        ['auto', 'scroll'].includes(c.overflowY);
    })
    .map(el => ({ className: String(el.className).slice(0, 100),
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  console.log({
    path: location.pathname, viewportCss: [innerWidth, innerHeight],
    devicePixelRatio, zoom: 'record browser zoom separately',
    documentHorizontalOverflowPx: widthOverflow,
    documentVerticalOverflowPx: heightOverflow,
    localScrolls, outOfBounds,
  });
})();
```

**판정 기준:** 가로 스크롤 `0px`; PC에서 일반 콘텐츠가 실제로 들어가는 경우 불필요한 세로 스크롤 `0px` (1~2px도 조사). 높이가 부족하거나 목록/글이 긴 경우 세로 스크롤은 **정상이며 숨기면 실패**. 키보드 `Tab`으로 마지막 요소와 내부 목록/버튼까지 모두 접근 가능해야 함. 스크린리더 포커스·모달 닫기·초대/수락·AI 선택 동작을 점검합니다.

## 별도 수행이 필요한 실제 환경 검증

- [ ] 로그인 2개 계정/기능 플래그 상태별 실제 앱 시각 캡처 및 위 매트릭스 기록
- [ ] 홈과 로비 1920×900/960의 1px 이상 불필요한 세로 스크롤 여부 확인
- [ ] 320/390/768에서 메뉴·카드·모달·버튼 가로 삐져나옴 0px 확인
- [ ] Chrome Zoom 200%에서 텍스트가 가려지지 않고 자연 스크롤·키보드 접근 가능
- [ ] 실제 일반·랭크·AI 게임에서 포인터 좌표/드래그/턴 판정 동일
- [ ] 랭킹 100명·검색 20명·친구 20명, 긴 닉네임과 401/503 상태에서 목록 끝까지 도달
- [ ] PR 최신 HEAD CI lint·typecheck·Vitest·Next production build 확인
- [ ] 스크린샷/실측 수치 및 실패 재현 정보를 Issue #104 및 상위 #102에 붙인 후 종료 판단

운영 DB/환경변수, Vercel 수동 배포, `main`·`develop` 직접 병합은 수행하지 않습니다.
