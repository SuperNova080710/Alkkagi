# XP·레벨 UI V1 — 구현·운영 인수

상위 UI #149 / 세부 #150(본인)·#151(공개/검증). 백엔드 #105, 병합 PR #110, [API 계약](experience-api-v1.md). 이 문서는 UI 코드와 운영 상태를 분리합니다.

## UI 구성
- `/profile`: `EXPERIENCE_UI_ENABLED=true`에서만 본인 `GET /api/experience/me` 조회 UI 렌더. Lv, 누적 XP, 다음 레벨까지 현재 구간 XP/전체 XP, 다음 목표 누적 XP, 최근 최대 20개 경기 보상(승·패·무/날짜/XP).
- `/players/:id`: 로그인 + 기존 공개 프로필 200 응답을 받은 뒤에만 `GET /api/experience/players/:id` 호출. **타인의 recentRewards는 일절 렌더하지 않습니다**.
- 프로필 로딩, 401 로그인 안내, 404 비공개·미존재 공통 안내, 503 운영 준비/일시 장애 안내와 재시도. 서버 SQL/스택 오류를 사용자에게 표시하지 않습니다.
- 진행 바는 API `currentLevelXp`와 `nextLevelCost`를 사용하고 0..100% 안으로 제한합니다. 경험치 보상/레벨을 클라이언트에서 계산하거나 지급하지 않습니다.
- 자기 프로필의 RP·닉네임·공개 설정·게임 보드와 레벨/XP를 분리하고 기존 UI를 유지합니다.
- 긴 보상 목록은 카드 내 스크롤로 처리하고 모바일 좁은 폭에서는 레벨 배지와 숫자가 줄바꿈됩니다.

## 운영 게이트
- 서버에서 읽는 `EXPERIENCE_UI_ENABLED` **기본 OFF**. 명시적 `true` 외에는 XP 컴포넌트를 마운트하지 않습니다.
- API는 별도 세션·RLS를 검증하며, 이 UI 플래그로 API 보안을 대체하지 않습니다.
- **운영 Supabase migration 008 적용은 미확인**: 검증과 승인 전에 프로덕션 플래그를 켜지 마세요.
- SQL 004~008 선행 적용, 두 계정(검색 공개/비공개) XP 접근, PvP/AI 승패 보상, 게임 종료 후 새로고침 등은 시스템/검토 담당의 별도 E2E 작업입니다.
- 새 `/profile` 페이지 렌더 성공이 운영 경험치 적립 성공을 뜻하지 않습니다.

## 확인 필요
- [ ] 테스트: 0XP Lv1, 180XP Lv2, 400XP 레벨 경계; 최근 기록 최다20개
- [ ] 장애: 401/404/503, malformed API 응답을 원문 없이 처리
- [ ] 보안: 공개 플레이어에 타인 recentRewards 보이지 않음, UUID·검색 공개 설정 선행
- [ ] 모바일 320/390, 태블릿 768, 데스크톱 1280/1920, 확대 200%, 키보드/스크린리더
- [ ] GitHub Actions `npm run check` lint/typecheck/Vitest/Next production build
- [ ] 운영 SQL 미적용·Vercel Preview/Production 미실행·실계정 E2E 미검증 구분

## 협업/브랜치
릴리스 정책 #144에 따라 `develop`에서 `feat/ui-experience-levels-v1`를 만들고 **PR은 develop 대상으로만** 생성합니다. main 직접 병합·운영 DB·수동 Preview는 변경하지 않습니다.
UI 파일: `src/components/experience/experience-panel.tsx`, `src/components/profile/profile-view.tsx`, `src/app/profile/page.tsx`, `src/components/players/public-player.tsx`, `src/app/players/[id]/page.tsx`, `src/app/arena.css`, `tests/experience-ui.test.tsx`.

다음 디자인 확장(별도 이슈): 코스메틱 #111의 실제 알·캐릭터 이미지/착용 UI. 본 PR에는 포함하지 않습니다.

**PR 작성까지만 수행하고 병합하지 않습니다.**
