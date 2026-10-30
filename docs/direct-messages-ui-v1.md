# 메신저 UI V1 — 구현·운영 인수

상위 이슈: #139 / 세부 #140(대화 화면), #141(친구 연결·반응형), #142(검증). 백엔드 계약: `docs/direct-messages-api-v1.md` / #77 / 병합 PR #81.

## 사용자 경로

- 로그인 후 `/friends`에서 친구별 **메시지** 또는 **메신저**로 이동.
- `/messages?peer=<friend-uuid>`로 대화 선택; 허용되지 않는 UUID는 무시.
- 연락처 목록은 `GET /api/friends`의 수락된 친구만 표시. 읽지 않은 수와 마지막 메시지는 `GET /api/messages`의 해당 친구와 합성. 친구가 아닌 사용자는 UI에서 대화 가능 목록에 나타나지 않음.
- 오른쪽 대화 패널: `GET /api/messages/:peerId?limit=30`, 최신순 결과를 **시간 순**으로 렌더링; 이전 기록은 `before`에 가장 오래된 **문자열 ID**를 넣어 불러옴.
- 메시지 전송은 `POST /api/messages/:peerId` + `{body,requestId}`. 양 끝 공백을 제거한 Unicode 1~500 코드포인트. 보내기 실패 시 본문을 바꾸지 않는 한 동일 UUID를 재사용해 멱등성 유지.
- 상대의 최신 메시지는 `PUT /api/messages/:peerId/read`로 읽음 커서 동기화. 대화 상대에게 내 메시지를 읽었는지 보여주지 않음.
- 한글 IME가 조합 중인 Enter는 전송하지 않으며 Shift+Enter로 줄바꿈.
- 새 스레드/친구와의 메시지는 Supabase Postgres Changes INSERT로 새로고침 트리거(수락 친구 RLS에 따라 전달되는 이벤트만 접근). **Realtime payload가 아닌 HTTP 응답**으로 데이터 재검증. WebSocket 유실 시 탭 포커스 복귀·가시성 복귀·수동 새로고침에서도 동기화.
- 401은 재로그인, 404는 친구 관계/차단 확인 + 로컬 대화 기록 비움, 429는 전송 속도 제한, 503은 이용 불가. 서버 SQL 원문 노출하지 않음.

## 기능 활성화 조건

`FRIENDS_UI_ENABLED=true` **및** `MESSAGES_UI_ENABLED=true` **두 조건을 동시에 충족**해야 `MessengerView`가 마운트되고 친구 목록에 대화 링크가 표시됩니다. 기본값은 둘 다 미설정 → OFF입니다.

이 서버 환경 플래그는 API 보안 정책 자체를 대체하지 않습니다. 실제 Auth/RLS/친구 관계·차단은 기존 서버 API/DB에서 검증합니다.

**운영 적용하지 않은 사항:**
1. SQL 004(보안) → 005(친구) → 006(DM) 마이그레이션 적용 및 실제 테이블/RLS/Realtime publication 확인.
2. 테스트용 A/B 2개 실계정으로 친구 수락→메시지 전송/읽음→차단·친구해제 후 대화 접근 거절 확인.
3. Vercel 서버 환경 변수 활성화 및 실제 Production E2E / 모바일 수동 검수.
4. Supabase Free Realtime 제한/재접속·브라우저 숨김 탭에서의 동기화 확인.

운영 적용은 시스템·검토 담당의 별도 승인 및 작업이며 이 PR에서 DB/배포를 변경하지 않습니다.

## 수용 체크리스트

- [ ] 메신저 OFF: `/messages`에서 '준비 중', 친구 목록에는 메신저/메시지 링크가 없어야 함
- [ ] 메신저 ON+친구 ON: 친구 대화/읽지 않은 수/빈 대화/새 친구 진입 가능
- [ ] 320·390·768·1366px 및 200% 확대: 긴 한글 닉네임/긴 문장, 내부 스크롤, 키보드 포커스, 액션 버튼 유지
- [ ] 최신 30건과 이전 cursor, bigint ID > JS Number.MAX_SAFE_INTEGER 문자열 그대로
- [ ] 전송 실패와 재시도 UUID, 1초 rate limit, 500 이모지, 공백만 입력 방지, 한글 IME
- [ ] 읽음 처리, 세션 만료, 친구 해제/차단 404에서 메시지 메모리 제거
- [ ] 새 메시지/신규 스레드 Realtime INSERT, 포커스 복귀 HTTP 재조회
- [ ] `npm run check`: lint/typecheck/Vitest/Next.js production build
- [ ] Production/Preview 배포와 실제 유저 A/B E2E 결과는 각각 따로 기록

## 수정 파일 경계

UI 담당: `src/app/messages/page.tsx`, `src/components/messages/**`, `src/components/friends/friends-view.tsx`, `src/app/friends/page.tsx`, `src/app/arena.css`, `src/proxy.ts`의 `/messages/:path*` 한 줄, `tests/direct-messages-ui.test.tsx`, 이 문서.

수정하지 않은 시스템 영역: `supabase/**`, `src/app/api/messages/**`, `src/lib/messages/**`, 게임 채팅/매치·RP 로직.

추후 SEO 기술 PR에서 `/messages` 및 경로 하위에 HTTP `X-Robots-Tag: noindex,nofollow` 보완 검토; 현재 UI 페이지 자체에는 noindex 메타데이터가 선언되어 있습니다.

## 현 상태

GitHub 브랜치에 구현 및 테스트 추가 완료, PR 생성·검토·CI 결과는 별도 확인. 운영 활성화/실제 Realtime 검증을 완료했다고 주장하지 않습니다.
