# 오목 15×15 UI 보드 계약 — #237 / #234

이 문서는 **서버와 분리된 보드 UI 컴포넌트**의 사용 계약입니다. #230 엔진, #232 DB, #233 PvP API는 다른 브랜치에서 개발 중이며 이 PR의 코드에 포함하지 않습니다.

## 사용

`OmokBoardView` (Client Component): `src/components/omok/omok-board-view.tsx`

- `board: unknown` — 서버 `board_state`의 JSON을 **15×15 `black/white/null`로 검증** 후 표시. 응답 오류·손상 데이터는 경고로 표시; 돌을 임의로 만들어내지 않습니다.
- `lastMove?: {row,col}|null` — 0 기반 행·열 좌표. 읽기에는 화면상 1~15행/열로 안내합니다. 가장 최근 착수 돌은 빨간 점으로 표시합니다.
- `stoneToPlace?: black|white`, `myTurn?: boolean`, `status?: waiting|active|finished`, `pending?: boolean` — 서버에서 제공한 상태를 **화면에서만 사용**합니다. 기본값은 상대 턴/read-only.
- `onPlace?: ({row,col}) => void` — 빈 칸·내 턴·활성·서버 요청 대기 아님 조건에서만 호출합니다. 실제 `POST /api/omok/matches/{id}/move` 전송 및 `requestId` 재시도/idempotency, 버전/턴 충돌·경기 상태·승리 판정은 **상위 매치 컨트롤러/서버**의 책임입니다. 보드 자체에서 규칙 계산/낙관 착수/승패 처리하지 않습니다.

## UI/접근성

- 15행 × 15열 = 225 `role=gridcell`, 1개의 tab stop(`tabindex=0`), ArrowUp/Down/Left/Right 및 Home/End 로빙 포커스, Enter/Space는 기본 button click에 위임.
- ARIA 라벨: `N행 M열, 빈 칸/흑돌/백돌, 마지막 착수`; 차례 상태는 `role=status`.
- 320px에서 개별 셀은 44px보다 작으므로, 조작 가능한 보드에서는 **44px 이상 행·열 선택 + '선택한 칸에 착수' 버튼**을 함께 제공해 작은 터치 타깃의 대체 경로를 확보합니다.
- 보드 스타일은 `src/components/omok/omok-board.css`에서 컴포넌트가 직접 가져옵니다. 공통 `arena.css`는 수정하지 않으며 클래스는 `arena-omok-board-*` 접두사로 격리합니다. 최근 착수는 선택(`aria-selected`)이 아닌 현재 기록 위치(`aria-current`)로 알립니다. 기존 알까기 Physics/Board/RADIUS/Shot/CSS에는 영향이 없습니다. 실제 320/390/768/1920 및 Chrome Zoom 200% **브라우저 픽셀 실측은 별도**.

## 인수/의존성

- 자동 검증: `tests/omok-board-ui.test.tsx` 15×15 및 손상 JSON, ARIA/키보드 코드 경계, 흑백/최근 착수, 준비/턴/종료, 320px 및 대체 조작 CSS.
- 실제 HTTP/Realtime 동기화·2계정 browser E2E·DB 적용·운영 UI 게이트는 #221 및 #234 후속 연결 PR에서 수행할 내용입니다.
- #237 PR은 독립 브랜치로 `develop`에 병합 요청만 합니다. 현재 `/omok` UI 진입은 별도 [#236](https://github.com/SuperNova080710/Alkkagi/issues/236) PR #239에서 작업 중이며, **본 보드 컴포넌트가 실제 경기 UI에 마운트됐다고 주장하지 않습니다**.

운영 SQL, 기능 플래그, Vercel, Preview/Production, main/release 브랜치 변경 없음.
