# Alkkagi Arena — 현재 개발·운영 상태 및 인수인계 (2026-10-30)

> **기준 시점:** 2026-10-30 KST, 릴리스 정책 전환 시점에는 `main`/`develop`이 `8cf4dc0`으로 같았으나 #159 develop 병합 후 서로 다른 HEAD가 됐습니다. 기존 PR **51건** 및 열린 PR **#159/#160/#161**은 당시 스냅샷입니다. 이후 **#159는 develop에 병합**됐으며 신규 코스메틱 UI #167·PG17 검사 #171이 열렸습니다. 이슈·PR 수량은 조회 시점의 스냅샷이며 이후 변경될 수 있습니다.
>
> **핵심 구분:** GitHub 병합 ≠ Supabase 운영 마이그레이션 적용 ≠ Vercel 최신 SHA 배포 ≠ 실제 두 계정·기기 E2E 성공. 아래 운영 항목은 관련 이슈에 기록된 **최종 확인 시점**을 인용합니다. 이 문서화 작업에서 운영 환경에 직접 변경을 가하지 않았습니다.

## 1. 현재 main에 포함된 작업

| 범위 | 근거 PR | GitHub 상태 | 검증 범위와 남은 확인 |
| --- | --- | --- | --- |
| P1~P3 일반전·랭크·경기 채팅·복구 | #17~#46의 해당 구현 PR | 병합 | 과거 P3 제출 시점의 실사용/DB/Production 증빙은 보존, 이후 최신 SHA 검증과 별개 |
| 대기실 AI 3단계 연습전 | #48 | 병합 | 실제 난이도별 플레이 인수 #47 잔여 |
| 목재·유리알 아레나 UI V1 | #61·#66·#68·#70·#71 | 병합 | 실제 회원/Realtime 통합 E2E 별도 |
| 공개 플레이어 검색·공개 설정 | 백엔드 #60 / UI #91 | 병합 | 본인 비공개→타인 검색/상세 E2E 별도 |
| 방 생성 RPC 남용 방지 | #69 | 병합 | PG16 독립 연결 경합 CI 성공, SQL 004 운영 적용 별도 |
| 친구 관계·차단 백엔드 | #76 | 병합 | SQL 005 운영 적용 및 A/B 실계정 E2E 별도 |
| 친구 DM·읽음 백엔드 + 화면 | #81·**#143** | 병합 | SQL 006 운영 적용·실제 Realtime/읽음 검증 별도, 친구/메신저 기능 플래그 모두 기본 OFF |
| 친구 대전방 초대 백엔드 | **#90** | **병합 완료** (2026-10-29) | PG16 독립 연결 경합 CI 3종 통과, SQL 007 적용/실계정 수락·코드 참가 E2E 별도. 초대 발송/수신 UI 미완료 |
| 친구 요청·목록·차단 UI | **#96** | **병합 완료** (2026-10-29) | UI 모의 브라우저 178 tests/빌드; `FRIENDS_UI_ENABLED` **기본 OFF**, 운영 DB 005/E2E/환경변수 활성화 미확인 |
| 문서 정합성 1차 | **#101** | **병합 완료** (2026-10-29) | 당시 기준 2026-10-29 현황을 기록한 스냅샷 |
| 데스크톱 정보 밀도·내부 스크롤 | **#109** | **병합 완료** (2026-10-29) | PC 패널·프로필 2열·랭킹 배치 구현; 당시 실제 앱 해상도별/200% 확대 및 CI 실측 성공을 보고하지 않음 |
| 로비 카드·사이드바·이미지/버튼 간격 | **#117·#119·#121** | **모두 병합** | **#119에서 #117의 부정확한 버튼 하단 패딩·테두리 변경을 원복**. 카드/진행 중 경기 간격, 하단 둥근 이미지, 열 하단 높이 정렬은 후속 PR 구현 기준. 실제 로그인 브라우저 광범위 QA 별도 |
| 1920×1080 히어로 비율·타이포그래피 | **#123·#125** | **모두 병합** | 원본 3:1 비율과 넓은 화면 제목 최대 크기 조정; Chromium **재구성 fixture**만으로 스크롤/잘림 확인, 실제 앱 인증 로비 E2E 별도 |
| XP·레벨·지급 원장 | **#110** | **병합 완료** | PG16 다중 연결 동시 경기 종료·일별 한도·RP/XP 롤백 통과, SQL 008 운영 적용·XP UI/E2E 별도 |
| 코스메틱 보유·장착 | **#115** | **병합 완료** | 미공개 아이템 코드 노출 수정·PG16 장착 동시성 검증 통과, SQL 009·외형 UI/E2E 별도 |
| 기술 SEO | **#131** | **병합 완료** | robots/noindex 충돌 수정, Google Search Console·최신 Production 검증 별도 |
| 공개 규칙·FAQ 가이드 | **#137** | **병합 완료** | `/how-to-play`·홈 링크 및 sitemap 2건 통합, 실제 HTTP/E2E 별도 |

## 2. 최근 기능 PR 병합과 운영 인수 경계

| 기능 PR | main 코드 검증 | 운영 활성화에 아직 필요한 사항 |
| --- | --- | --- |
| [#110 XP·레벨](https://github.com/SuperNova080710/Alkkagi/pull/110) | 병합 · Quality **44파일/216테스트** · PG16 다중 연결 XP/RP 정산·롤백 검증 | SQL 008 운영 적용 여부 확인, 계정 E2E·XP UI |
| [#115 코스메틱](https://github.com/SuperNova080710/Alkkagi/pull/115) | 병합 · 통합 Quality **46파일/231테스트** · PG16 장착 경합·비공개 전환 검증 | SQL 009 운영 적용 여부 확인, 실계정 공개 범위·에셋/UI |
| [#131 기술 SEO](https://github.com/SuperNova080710/Alkkagi/pull/131) | 병합 · robots/noindex 상충 해결 및 자동 검사 성공 | 최신 Production HTTP·Search Console 소유권·실제 색인 |
| [#137 공개 규칙 가이드](https://github.com/SuperNova080710/Alkkagi/pull/137) | 병합 · 공개 `/how-to-play`·홈 링크·sitemap 2건 | 실제 배포 HTTP 200, 브라우저 기기별 시각 E2E |

공개 안내 페이지와 SEO 홈 canonical은 충돌 없이 함께 병합됐습니다. `src/app/page.tsx`의 홈 metadata와 가이드 링크가 모두 남아 있으며, Production 사이트맵에 `/`와 `/how-to-play`가 포함됩니다. **Search Console 작업과 Google 색인 노출은 미확인**이고, 배포 성공 주장도 하지 않습니다. [SEO 인수 절차](google-search-seo.md)를 참고하세요.

## 2-1. 메신저 UI 및 릴리스 정책 추가 (2026-10-30)

- **메신저 UI PR [#143](https://github.com/SuperNova080710/Alkkagi/pull/143) 병합**: `/messages`, 친구 대화·읽음, Realtime 알림 후 HTTP 재조회, IME/동일 requestId/문자열 cursor 보호. GitHub Quality #40980767099 성공(47파일·239테스트). **운영 SQL 004~006 및 두 계정 브라우저/Realtime, 320·390·768·1366px/200% 확대 수동 E2E는 미확인**. [화면 계약](direct-messages-ui-v1.md).
- **브랜치/릴리스 정책 PR [#148](https://github.com/SuperNova080710/Alkkagi/pull/148) 병합**: `main` Production, `develop` 개발 통합, `release/vX.Y.Z` RC 수동 CLI Preview. `vercel.json`에서 Git 자동 배포는 main만 허용. 조회 당시 두 브랜치 HEAD `8cf4dc0` 일치. **Vercel 실제 설정 적용·첫 RC Preview·공식 버전 태그 및 GitHub Release 미검증/미발행**으로 분리합니다.
- **문서 PR #138도 병합 완료.** 이전 44개 PR 집계는 그 당시 스냅샷입니다.
- **XP 프로필 UI [#159](https://github.com/SuperNova080710/Alkkagi/pull/159)** develop 병합 완료(하위 #150/#151 구현). `EXPERIENCE_UI_ENABLED` 기본 OFF, 운영 SQL 008 미확인. 코스메틱도 아직 장착/외형 UI·SQL 009 운영 인수 별도.

[릴리스 운영 매뉴얼](release-process.md) · [CHANGELOG](../CHANGELOG.md)

## 2-2. 진행 중인 기능 UI 및 운영 사전점검 PR (2026-10-30)

| PR / 이슈 | 최신 확인 내용 | 아직 완료되지 않은 일 |
| --- | --- | --- |
| [#159 XP 프로필 UI](https://github.com/SuperNova080710/Alkkagi/pull/159) · #149/#150/#151 | **develop 병합 완료**, 최종 리뷰 보완 HEAD `79a3325`; 본인/공개 레벨·게이지·최근 보상(본인 한정), 비정상 JSON 방어, `EXPERIENCE_UI_ENABLED` 기본 OFF. Quality #40984428949 **49파일/249테스트 PASS** | SQL 008 운영 적용, 2계정 공개 범위 E2E, 모바일/200% 확대 수동 QA |
| [#161 DB preflight](https://github.com/SuperNova080710/Alkkagi/pull/161) · #155~#158 | `develop` 대상 **Draft·미병합**, HEAD `547bd9e`; SELECT-only 68항목, 004 오탐으로 인한 자동 ready 판정 제거·inspect 유지, Push #40984558499·PR #40984564283 **49파일/245테스트 PASS** | 운영 SQL **적용하지 않음**, PG17 스테이징·백업·권한/동시성/E2E·RC STOP 게이트 수용 |
| [#162 코스메틱 UI](https://github.com/SuperNova080710/Alkkagi/issues/162) · #163~#165 | 인벤토리·6종 미리보기·알 외형을 일반/랭크/AI 화면에 연결하는 디자인 이슈가 개설됨 | 화면 구현 PR 및 에셋·브라우저 수용/운영 SQL 009 전부 별도 |

**운영 확인 출처:** #155 및 PR #161은 **Supabase Production PostgreSQL 17.11**의 카탈로그/마이그레이션을 읽기 전용으로 조회해 **68항목 중 baseline 7 ready, 004 1 inspect, 005~009 60 pending**을 기록했습니다. 004의 방 생성 RPC는 있으나 5회/10분 제한의 소스 마커가 없고, 005~009 핵심 객체가 존재하지 않습니다. `main`과 `develop`의 SHA `8cf4dc0`과 Production Vercel 최신 READY 보고가 있지만, 이는 운영 DB 적용·실제 HTTP/로그인/Realtime E2E 성공이 아닙니다. **실제 배포 정책 적용/첫 수동 RC Preview도 별도 검증**입니다. 이 수치는 PR 기록에 근거하며 본 문서 작업에서 운영 DB를 새로 조회하거나 수정하지 않았습니다.

- [DB 운영 사전점검 PR 브랜치 문서](https://github.com/SuperNova080710/Alkkagi/blob/feat/ops-db-preflight/docs/db-rollout-preflight.md) — main에는 아직 포함되지 않습니다.
- [XP UI 인수 문서](https://github.com/SuperNova080710/Alkkagi/blob/develop/docs/experience-ui-v1.md) — develop에 병합됐지만 main Production 릴리스는 미완료입니다.

## 3. Supabase 운영 DB 및 배포의 정확한 경계

| SQL | GitHub 상태 | 마지막 확인된 운영 적용 상태 |
| --- | --- | --- |
| P1~P3 초기 SQL, AI 002, 플레이어 검색 003 | 병합 | 이전 제출/운영 확인 기록 존재 |
| `202610290004_security_room_create_limits.sql` | #69 병합 | **2026-10-30 PG17.11 점검에서 미적용/제한 마커 없음** |
| `202610290005_friends_v1.sql` | #76 병합 | **2026-10-30 PG17.11 점검에서 미적용** |
| `202610290006_direct_messages_v1.sql` | #81 병합 | **2026-10-30 PG17.11 점검에서 미적용** |
| `202610290007_room_friend_invites_v1.sql` | #90 **병합** | **2026-10-30 PG17.11 점검에서 미적용** |
| `202610290008_xp_levels_v1.sql` | #110 **병합** | main 소스 포함, **2026-10-30 운영 PG17.11 사전점검에서 적용 이력·객체 없음** |
| `202610290009_cosmetics_v1.sql` | #115 **병합** | main 소스 포함, **2026-10-30 PG17.11 사전점검에서 미적용** |

**운영 재점검 우선:** 실제 `schema_migrations` 적용 이력과 테이블/RPC/RLS/GRANT를 직접 다시 확인하세요. 004→005→006→007은 파일 번호 순서와 함수 의존성을 검증하고 적용해야 하며, 초대 007은 친구 005가 선행되어야 합니다. XP 008은 기존 경기/AI 테이블에 의존하고, 코스메틱 009는 레벨에 따라 008과 연동됩니다. 번호만으로 무조건 SQL을 재실행하지 마세요.

- **Vercel Free:** 2026-10-29 일일 배포 한도 소진/Preview 미생성이 보고됐습니다. PR #161 조사상 Production 최신 SHA `8cf4dc0`은 READY이지만, 이것만으로 실제 HTTP 응답/사용자 E2E 검증을 주장하지 않습니다. GitHub Quality CI도 별개입니다.
- 친구 UI는 main에 있지만 **`FRIENDS_UI_ENABLED=true` 운영 확인 전에는 준비 중 화면**입니다. 플래그는 UX 게이트일 뿐 서버 인증/RLS를 대체하지 않습니다.
- 경기 채팅(`match_messages`)과 친구끼리의 DM(`dm_messages`)은 다른 기능입니다. DM 서버 API(#81)와 메신저 UI(#143)는 모두 코드 병합됐지만 `FRIENDS_UI_ENABLED`와 `MESSAGES_UI_ENABLED`가 동시에 `true`여야 노출되고 SQL 006·실사용자 E2E/운영 활성화는 별도입니다.
- **ALEPH P3 실제 폼 접수/승인**은 [#3](https://github.com/SuperNova080710/Alkkagi/issues/3)에서 확인되지 않았습니다. [P2](p2-submission-2026-10-28.md)·[P3](p3-final-submission-2026-10-29.md) 과거 제출 문서는 당시 상태 그대로 유지합니다.

## 4. 개발 채팅 간 작업 소유권

- **시스템:** DB `supabase/**`, 서비스·권한 `src/lib/**`, `src/app/api/**`, 실제 경기/XP/RP 경계, SQL/HTTP/독립 PG16 테스트. 병합된 XP·코스메틱·SEO API의 운영 인수와 미적용 SQL 검증을 별도 이슈로 관리.
- **UI/UX:** `src/components/**`, 페이지 JSX·렌더링, `src/app/arena.css`, 모바일/전체화면 실측, 친구/초대/XP/코스메틱 시각 UI. PC 밀도 #102·히어로 #122/#124·SEO 콘텐츠 #130 등.
- **문서(이 대화):** `README.md`, `plan.md`, `docs/**/*.md`, 이슈 본문/상태만 수정. 운영 SQL/환경변수/배포와 PR 병합 금지.
- **공유 경계:** `src/proxy.ts` matcher에 기존 `/players/:path*`, `/friends/:path*`, `/api/messages/:path*`, `/api/room-invites/:path*`를 보존하고 현재 `/api/experience/:path*`·`/api/cosmetics/:path*`를 포함한 보호 경로를 보존. SEO는 `src/app/layout.tsx` 및 홈의 **metadata export**만, 디자인은 같은 파일 JSX/스타일만 수정하도록 구분.
- **작업 방식:** 기능 단위 상위 이슈와 작업 가능한 세부 이슈 → develop 기반 독립 브랜치 → 검증 가능한 커밋 → develop 대상 PR → release/vX.Y.Z RC·수동 Preview → 별도 리뷰 채팅에서 main 출시 승인. 별개 채팅은 최신 GitHub 이슈/PR을 통해 상태를 공유합니다.

## 5. 남은 후속 확인

1. **DB/보안 담당** [#16](https://github.com/SuperNova080710/Alkkagi/issues/16), [#62](https://github.com/SuperNova080710/Alkkagi/issues/62), [#65](https://github.com/SuperNova080710/Alkkagi/issues/65): 004~007 실제 적용/권한/누출 비밀번호 제한 및 실계정 악용·경쟁 검증.
2. **친구·초대/DM 통합** [#72](https://github.com/SuperNova080710/Alkkagi/issues/72), [#77](https://github.com/SuperNova080710/Alkkagi/issues/77), [#82](https://github.com/SuperNova080710/Alkkagi/issues/82), [#92](https://github.com/SuperNova080710/Alkkagi/issues/92): 005~007 실제 DB·두 계정 E2E·UI 활성화·친구 초대 UI. DM 화면 코드는 PR #143으로 병합됐으나 기본 OFF.
3. **UI 수용** [#102](https://github.com/SuperNova080710/Alkkagi/issues/102), [#118](https://github.com/SuperNova080710/Alkkagi/issues/118), [#122](https://github.com/SuperNova080710/Alkkagi/issues/122), [#124](https://github.com/SuperNova080710/Alkkagi/issues/124): 병합된 CSS/반응형 조정의 실제 앱 크기별·200% zoom·긴 데이터 접근 및 미세 스크롤 확인.
4. **XP·코스메틱 인수** [#110](https://github.com/SuperNova080710/Alkkagi/pull/110), [#115](https://github.com/SuperNova080710/Alkkagi/pull/115): 두 PR은 병합됐으나 DB 008/009는 별도 운영 검증과 승인 필요. XP UI #159는 develop에 병합됐으나 기본 OFF, 코스메틱 외형 UI #167과 게임판 연결 #165는 별도 진행. SQL 008/009 운영 적용은 둘 다 미완료.
5. **SEO·공개 가이드** [#131](https://github.com/SuperNova080710/Alkkagi/pull/131), [#137](https://github.com/SuperNova080710/Alkkagi/pull/137): 코드 통합 완료. 남은 작업은 Production HTTP/robots/sitemap 2건 검증과 Search Console 등록·색인 요청, 공개 UI 접근성 확인.
6. **ALEPH** [#3](https://github.com/SuperNova080710/Alkkagi/issues/3): 최종 제출 접수 여부 확인 후 상태 정리.

## 근거 문서
- 이전 날짜의 [인수 현황](current-status-2026-10-29.md)은 역사적 스냅샷으로 보존합니다. **현재 상태는 이 문서가 우선합니다.**
- [친구 UI](friends-ui.md) · [친구 API](friends-api-v1.md) · [친구 초대](room-friend-invites-api-v1.md) · [DM API](direct-messages-api-v1.md).
- [데스크톱 밀도 변경](ui-density-2026-10-29.md) · [와이드 히어로 검증](ui-hero-wide-review-2026-10-29.md).
- **문서 정합성 기준은 GitHub PR 실제 merged_at/state 및 관련 CI 결과**입니다. 이 작업에서 브라우저 실계정 E2E·운영 SQL·Vercel 배포를 새로 실행하지 않았습니다.
