# 오목 보드 실브라우저 QA — #251

## 근거
PR #241 리뷰에서 요구한 실제 320px·키보드 수용 검증을 독립된 GitHub Actions로 재현합니다. PR #239/#241은 이미 `develop`에 병합되었습니다. 게임판 UI 서버 컴포넌트는 아직 실제 온라인 매치에 연결되지 않았으므로, 기존 공개 화면 검사만으로 실사용을 검증했다고 볼 수 없습니다.

## 실행 구조
- [`.github/workflows/omok-board-browser.yml`](../.github/workflows/omok-board-browser.yml)가 GitHub-hosted runner에서 Node 24/사전 설치된 Chrome을 사용합니다.
- 빌드 직전에만 `src/app/omok-browser-qa-fixture/page.tsx`를 작업 디렉터리에 생성합니다. **이 라우트는 Git 커밋에 없으며 Vercel Preview/Production의 실제 소스에도 들어가지 않습니다.**
- CI 전용 React Client fixture는 15×15 보드, 중앙 흑돌, 가장 최근 착수 좌표 및 가짜 `onPlace` 이벤트 기록을 제공합니다. 이 이벤트 기록은 브라우저 UI 동작을 관찰하기 위한 것으로 **게임 규칙/서버 정산/낙관적 경기 동작 구현이 아닙니다.**
- `scripts/qa/omok-board-browser.mjs`는 실제 production `next start` 및 Chrome DevTools Protocol로 아래를 검사합니다.

| CSS viewport | 검사 |
|---|---|
| 320×720 | 225셀, 15행, 단일 Tab 정지점, 스크롤/정사각형/44px 대체 입력, 키보드 착수 |
| 390×844 | 동일 |
| 768×1024 | 동일 |
| 960×540 | 1920×1080 화면을 200% 확대했을 때의 **CSS 폭 근사**. 실제 Chrome Zoom 200%가 아님 |
| 1920×1080 | 동일 |

각 크기에서 중앙 돌의 Enter 착수 차단, ArrowRight로 이동, 빈칸 Enter 1회 처리, 중복 Enter 차단, Home/End 좌표 이동까지 브라우저로 실행합니다. 가로 오버플로 1px 초과 또는 보드/버튼 구조 위반은 CI 실패로 처리합니다. 결과 JSON과 PNG 5장을 GitHub Actions artifact로 7일 보관합니다.

## 검증 경계

- 이 검사로 **서버 인증·Supabase RLS·Realtime·멀티플레이 동시성·실계정 A/B·오목 랭크/AI 정상 작동은 확인할 수 없습니다**. 시스템 #232/#233/#238/#240/#242/#245 병합 및 온라인 실제 대전 인수 후 별도 E2E가 필요합니다.
- 실제 브라우저 설정의 **Zoom 200% 자체**는 직접 설정하지 않으며, 해당 항목은 별도 사람이 또는 화면 공유 가능한 브라우저 인수에서 확인해야 합니다.
- 이 CI 자체는 새 Supabase 접속·운영 SQL 실행·환경변수 변경·Vercel 배포를 하지 않습니다.
- 본 UI 채팅에서는 새 QA PR을 `develop`에 올리고 병합은 별도 검토 담당이 수행합니다.
