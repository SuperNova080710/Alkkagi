# Cosmetics Wardrobe UI V1 — 구현/운영 인수

상위 UI 이슈 [#162](https://github.com/SuperNova080710/Alkkagi/issues/162), 세부 #163(장착/인벤토리), #164(6종 시각/반응형), #165(경기판 외형 후속). 백엔드/API #111 및 [docs/cosmetics-api-v1.md](./cosmetics-api-v1.md).

## 이번 UI PR에 포함된 내용

- 로그인 보호 `/cosmetics`: 서버의 `COSMETICS_UI_ENABLED === 'true'`에서만 `CosmeticWardrobe` 로드. 기본값 OFF면 "준비 중" 카드만 표시하고 **코스메틱 API 요청 컴포넌트를 마운트하지 않습니다**.
- ArenaShell 주요 메뉴에 "꾸미기" 링크 추가. 동일한 기능 플래그가 true인 경우에만 노출. 프로필 화면은 기존대로 유지하므로 XP/레벨 PR #159와 UI 파일 충돌을 최소화.
- 본인 `GET /api/cosmetics/me`: `items[]`, `loadout`, `rankedWins`, `level`을 그대로 사용. 스타터/랭크승/XP레벨 조건을 설명하지만 클라이언트 계산으로 아이템을 **해금하지 않습니다**. `owned=true`이면서 `equipped=false`인 서버 응답 아이템만 장착 가능.
- 장착 `PUT /api/cosmetics/equip` → `{"itemCode":"piece-forest"}` 단일 필드 JSON, same-origin/no-store. 성공 시 임시 장착 상태를 확정하지 않고 **서버의 최신 인벤토리를 재조회**. 실패 시 401/403/400/404/409/503 구분하며 SQL 본문/내부 오류를 표시하지 않음.
- 6종 CSS 미리보기: `piece-classic`, `piece-forest`, `piece-starlight`, `avatar-classic`, `avatar-bronze`, `avatar-orbit`. **시각용 삽화이며 게임 보드에는 아직 적용되지 않았습니다.**
- API가 돌려준 미등록 코드 또는 슬롯이 다른 코드에는 **동일 슬롯 스타터 디자인**으로 폴백. 외부 URL이나 코드 경로를 조합하지 않음.
- 데스크톱 3열 / 태블릿 2열 / 모바일 1열 카드 및 모바일 6메뉴 줄바꿈 대응, 장착/잠금 상태 구분, 키보드 포커스, 에러 및 로딩 안내.
- 개인 데이터 검색 비색인 `robots: noindex,nofollow`.

## 009 운영 적용·권한 검증 선행 조건

1. 시스템/운영 담당의 SQL 004~009 적용 및 RLS/GRANT/PostgreSQL 환경 점검. SQL 008을 적용하지 않으면 Lv.1 고정으로 레벨 아이템은 잠길 수 있음.
2. 사용자 A/B 실제 계정: 초기 2개 스타터 보유/장착, 랭크 1·3승 아이템, Lv2·3 아이템 해금/보유 영구 유지 확인.
3. 401 익명, 403 Origin 거부, 409 잠금, 404 미공개/없는 아이템, 503 마이그레이션 미적용 동작 확인.
4. 운영 환경 `COSMETICS_UI_ENABLED=true` 설정은 **SQL/E2E 통과 후** 사용자가 승인한 릴리스에서만.
5. 최신 Vercel 배포/실계정 E2E/모바일 실제 시각 검증은 이 PR에서 수행하지 않음. 기능 OFF라고 해서 서버 API/RLS 권한이 강제되는 것은 아니므로 API 자체 보안도 별도 유지.

## 경기판 적용은 별도 작업 #165

- 현재 `GamePieces` SVG 물리 반경/보드 좌표/샷/움직임은 건드리지 않습니다.
- 이미 서버가 반환하는 공개 로드아웃 코드 `GET /api/cosmetics/players/:id`를 이용한 시각 렌더와 AI 상대 기본 알, 재생 애니메이션, 공개 권한 거부·미적용 시 기본 외형 폴백은 **별도 UI 브랜치/PR**에서 구현·검증.
- 기존 게임 좌표 테스트와 `RADIUS` 값이 변하지 않아야 함.

## 리뷰/검증 체크리스트

- [ ] GitHub Actions `npm run check`(lint/typecheck/Vitest/Next production build) 최종 HEAD PASS
- [ ] `COSMETICS_UI_ENABLED` off/on SSR 및 네비게이션/보안 경계 테스트
- [ ] 실제 320/390/768/1280/1920px, 200% 브라우저 확대에서 수평 오버플로, 카드 터치 영역, 키보드 전용 조작 확인
- [ ] 코스메틱 초기/잠김/보유/장착/장착 실패/재조회 2계정 E2E
- [ ] 게임판 외형 연동 여부를 "미구현"으로 명시, 고객에게 장착=게임판 스킨 변경 완료로 오해시키지 않기
- [ ] `develop`으로 PR 검토 후 병합, 이후 release 브랜치에서 수동 Preview 검증. 이 채팅에서는 병합 금지.

## 변경 파일 경계

UI: `src/app/cosmetics/page.tsx`, `src/components/cosmetics/*`, `src/components/ui/arena.tsx`, `src/app/arena.css`, `tests/cosmetics-ui.test.tsx` 및 본 문서.

수정 금지/미수정: `supabase/**`, `src/app/api/cosmetics/**`, `src/lib/cosmetics/**`, `src/components/game/**`, 물리 엔진/랭킹, 운영 설정/배포.

**PR까지만 진행하고 main/develop 병합과 Vercel 수동 배포, 운영 DB DDL은 수행하지 않습니다.**
