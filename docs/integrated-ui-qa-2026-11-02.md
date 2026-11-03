# UI 통합 QA — #194 / 2026-11-02

> **최신 정정 (2026-11-03):** 공개 viewport #197, 초대 SSR #200, 전체 UI 회귀 #202 병합. Preview UI 문구 보완 #210/#212 및 로비 XP #214/#215도 반영. 자동 Chromium/mock QA는 로그인된 두 계정의 실제 Preview/200% 확대·AI/Realtime 동작을 증명하지 않으며 #194/#206/#211이 남았습니다. [현재 인수](current-status-2026-11-03.md). 아래 오래된 미병합·미적용/미구현 문구는 당시 기록으로 보존합니다.


## 기준과 범위

- 기본 통합 기준: `develop` / `c63f570f383d2419d3df156e28e82f1eba29c9d2` (브랜치 생성 시점).
- 검증 대상: #104 레이아웃, #179 친구 초대·대기실, #139 메신저, #149 레벨·XP, #162 코스메틱 인벤토리, #165 인게임 스킨.
- 추가 버그: **메신저 SQL 응답 `get_direct_message_inbox()`는 `lastMessage`를 객체/null로 반환하는데 이전 UI는 문자열로 가정**. 이 PR에서 타입, 실제 미리보기 본문, 모든 메신저 목록/메시지 HTTP 200 입력 스키마 검증을 수정합니다.
- 기존/추가 Vitest는 격리된 로컬 실행입니다. HTML/SSR 정적 검증을 실제 로그인 사용자 브라우저 E2E 또는 영상/스크린샷으로 표현하지 않습니다.

## 게이트

| 범위 | 검증 수단 | 완료 기준 |
|---|---|---|
| 전역·인증·TypeScript·디자인·전체 기능 단위 | GitHub Actions `Quality checks` | ESLint 경고 0 + TypeScript + Vitest 전체 + production build |
| #104 공개 화면 10종 뷰포트 × 공개 4경로 | [PR #197](https://github.com/SuperNova080710/Alkkagi/pull/197)의 독립 Chrome Actions | 기존 run #41369486372 40/40 PASS; 이 브랜치 코드는 별도 PR이므로 재실행 전 통합 브랜치 PASS 주장 금지 |
| #179 대기실 역할별 SSR·44px | [PR #200](https://github.com/SuperNova080710/Alkkagi/pull/200) | 기존 run #41373660483 PASS. 해당 PR 병합 전에는 현재 `develop`에 추가 검사가 없음 |
| #139 메신저 SQL/UI 계약 | `tests/direct-messages-*.test.*` + `tests/integrated-ui-qa.test.tsx` | SQL의 `lastMessage.body` 표시, 중첩 JSON/읽음·전송/에러 마스킹 |
| #149 XP·레벨 | `tests/experience-ui.test.tsx`, `xp-levels-*.test.ts`, 통합 테스트 | 0XP·레벨 경계/보상 보호/진행률 |
| #162·#165 코스메틱 | `tests/cosmetics-ui.test.tsx`, `match-cosmetics-ui.test.tsx`, 통합 테스트 | 목록 검증·해금/장착·fallback·좌표/RADIUS 불변 |
| Auth·Realtime·2계정 격리된 자동 동작 | `Supabase local Auth + Realtime integration E2E` | **로컬 Docker 임시 Supabase Auth/API/Postgres/Realtime**, 원격 URL 차단, 자동 재생·채팅/친구/초대 등 기존 스크립트 PASS |
| PostgreSQL17 운영 호환성 **격리 재현** | `PostgreSQL 17 full migration rollout` | Docker postgres:17 내 전체 마이그레이션/RLS/RPC 검사 PASS |
| PostgreSQL17 복구 가능성 **격리 재현** | `PostgreSQL 17 backup and restore drill` | Docker postgres:17에서 테스트 데이터 백업·복원 검사 PASS |

각 게이트 실행 기록은 해당 PR Actions run에 남깁니다. 브랜치 `chore/ci-integrated-ui-qa-v1`을 `develop` 대상으로 PR을 열면 기존 워크플로 정책상 `chore/ci-` prefix가 로컬 DB 검사들을 자동 실행합니다. 운영 Supabase 서비스 키·운영 DB 연결·Vercel Preview 배포·프로덕션 변경은 하지 않습니다.

## 실계정/실브라우저 인수의 별도 게이트 — **완료 여부를 추정하지 않음**

- [ ] 실제 로그인 계정 A/B: 친구 초대 송·수신/차단/거절/동시 입장/만료
- [ ] 메시지 양방향 발송·수신, IME·키보드 포커스·읽음/Realtime·스크롤 유지/읽지 않은 배지
- [ ] XP 실제 일반/랭크/AI 경기 종료 보상, 공개 프로필 개인정보, 레벨 상승
- [ ] 6종 장착 및 일반전/랭크/AI에서 상대/본인 스킨, 비공개 404 fallback
- [ ] 실제 `1920×900/960/1080`, `1280×720`, 모바일 320/390/768, 브라우저 **실제 Zoom=200%**, 일반전/랭크/AI 포인터·화면 스크롤·포커스 테스트
- [ ] 운영 PostgreSQL 17.11의 SQL 004~009/RLS/RPC/Realtime/기능 플래그 상태 **운영 담당 검증 기록** (로컬 E2E와 구분)
- [ ] PR #197/#200 반영 후 최신 `develop` 재회귀 및 릴리스 브랜치 수동 Preview/Production 인수

## QA 기록 원칙

- `PASS`: **실행 증거**가 있는 해당 영역만. `NOT RUN`: 실행 도구/로그인/환경이 없어 실행하지 못한 영역. `FAIL`: 실측 재현된 문제.
- 신규 메신저 응답 검증은 200 JSON 내부 객체까지 런타임에서 검사하여 손상/비정상 데이터를 503 사용자 안내로 변환합니다. SQL/보안/RLS 자체를 수정하지 않습니다.
- 기존 수동 배포 한도 보호: Actions 격리 runner만 사용, 사용자 승인 없는 운영 쓰기/배포/PR 병합 금지.
