# 친구 대전방 초대 UI · 일반전 3D 디자인 통일 V6

작업 이슈: [#179](https://github.com/SuperNova080710/Alkkagi/issues/179). 서버 초대 계약: [docs/room-friend-invites-api-v1.md](room-friend-invites-api-v1.md) / 병합 PR #90.

## 사용자 동선

- **일반전 방 만들기 → 호스트 대기실**: 방 생성자(선공·seat 1), `waiting`, 참가자 1명일 때 친구 초대 UI를 표시합니다. GET `/api/friends`의 수락 친구 중 선택 → POST `/api/room-invites`에 `roomId,targetId`만 전송. GET `/api/room-invites/sent?roomId`에서 발송/수락/거절/만료 상태를 확인합니다.
- **친구 페이지 → 받은 대전 초대**: GET `/api/room-invites`를 표시하며 POST `/api/room-invites/:inviteId/respond` `{"accept":true|false}`로 수락/거절합니다. 수락 응답의 검증된 `roomId`로만 `/rooms/:roomId`에 이동합니다.
- 초대는 기존 일반전 참가 코드 및 방 좌석 RPC와 공존. 친구가 수락하면 서버가 방 seat 2를 지정하며, 현재 대기실의 기존 `RoomRefresh`가 참가 상황을 갱신합니다. 5분 TTL·중복·10분 제한·친구/차단 검증은 **서버/DB에서만** 수행합니다.
- 받은 초대/보낸 초대 목록은 화면 최초 진입·탭/창 포커스 복귀 및 수동 버튼에서만 갱신합니다. 새 Realtime publication을 만들거나 고빈도 폴링하지 않습니다.
- 오류는 401/403/404/409/429/503에 대해 사용자 안내로 치환하고 서버 SQL 내용은 노출하지 않습니다. 초대 코드/이메일/비공개 데이터는 수신 목록에서 표시하지 않습니다.

## 배포 기능 플래그

`FRIENDS_UI_ENABLED=true`와 `ROOM_INVITES_UI_ENABLED=true`가 **모두 참**일 때만 서버 페이지에서 신규 초대 컴포넌트를 렌더링합니다. 두 플래그는 기본 OFF입니다. 기존 일반전 코드 참가/AI/친구 관리 기능은 동일하게 유지합니다.

초대 백엔드는 운영 SQL 005(친구)와 007(초대)을 필요로 합니다. **운영 적용 이력/실제 두 계정 E2E가 확인되지 않았으므로 기본 OFF를 유지해야 합니다.** UI 플래그는 서버 보안을 대체하지 않으며 기존 API의 Auth/CSRF/RLS/동시성 권한이 최종 판단입니다.

## 시각 시스템 통일

- 메인 로비의 `arena-button`, `arena-button--gold`, `arena-button--blue`, `arena-button--outline`를 방 생성/참가·경기 시작/나가기·AI 난이도·친구 초대/수락/거절 액션에 재사용합니다.
- 일반전 대기실은 입체형 크림 헤더, 참가자 2석(선공 금색/후공 파랑), 상태 배지, 호스트 초대/AI 카드, 안쪽 스크롤 가능한 발송 내역. 운영 초대 OFF여도 AI 카드 디자인은 동일합니다.
- 친구 관리 버튼도 경계선과 그림자/눌림 효과를 통일하고, 받은 초대 목록은 친구 페이지에서 한곳에 확인하도록 배치했습니다.
- 모바일 320/390에서 1열/레이아웃 줄바꿈, 태블릿 768에서 AI/초대 병렬 가능, 대형 화면에서는 왼쪽 참가자/오른쪽 초대 카드로 공간 활용. 긴 닉네임·제한된 영역에서는 줄바꿈 및 패널 내부 스크롤을 사용합니다.
- 일반/랭크/AI **진행 중** 경기의 `GameBoard`, `GamePieces`, `src/lib/game/**`, `RADIUS`, 보드 viewBox, 좌표·샷·물리·랭크 RP는 수정하지 않았습니다. 기존 서버 액션 `startGame`, `leaveRoom`, `createRoom`, `joinRoom`, `addAiOpponent` 그대로입니다.

## 인수 검사

- [ ] `npm run check` (ESLint·TypeScript·Vitest·Next.js build) GitHub Actions 성공
- [ ] 기본 OFF: 친구 초대 버튼/받은 초대 GET/보낸 초대 GET 요청 미마운트, 코드 참가·AI 전환은 계속 가능
- [ ] 호스트 waiting 1/2 vs 게스트·2/2 vs active: 초대 폼은 호스트 대기방에서만 제공
- [ ] 인접 중복 클릭, 401 로그인 만료, 404 만료/친구해제, 409 재초대, 429 제한, 503 DB 미준비
- [ ] 실제 사용자 A/B: 수락 시 좌석 2 진입, 동시 초대/코드 경쟁, 방 종료/AI 시작 시 404, 차단 직후 비활성
- [ ] 320·390·768·1280·1920px, 200% 확대, 전체 화면 불필요한 수평/세로 스크롤, 접근성 포커스/키보드, 버튼 터치 영역
- [ ] 실제 운영 SQL 005·007/2026-10-30 이후 운영 DB 상태 별도 검증

## 협업

릴리스 정책 #144에 따라 `feat/ui-room-friend-invites-3d` → `develop` PR 작성만 수행. 이 대화에서 병합·운영 SQL/환경 플래그 설정·수동 Vercel Preview 배포는 하지 않습니다.

변경 경계: `src/app/rooms/[id]/page.tsx`의 대기실 JSX, `src/app/friends/page.tsx`의 UI 게이트, `src/components/{rooms,friends}/**`의 UI, `src/app/arena.css`, UI 테스트·문서. 시스템 API·SQL·게임 로직 비변경.
