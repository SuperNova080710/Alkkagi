# Alkkagi Arena — 현재 개발·운영 상태 및 인수인계 (2026-10-30)

> **기준 시점:** 2026-10-30 KST, GitHub `main` HEAD `cd5739bf0b33ef52acf9eda6b81a5e366f2d9aa7`. 조회 당시 GitHub 일반 이슈 **87건**, PR **44건**(문서화 이슈 #134 이후 신규 생성분은 집계 제외). 이후 같은 날 공개 가이드 PR #137 및 문서 PR #138이 생성됐습니다. 현황은 계속 변할 수 있으며 최신 이슈/PR 상태가 우선합니다.
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
| 친구 DM·읽음 백엔드 | #81 | 병합 | SQL 006 운영 적용·실제 Realtime/읽음 검증 및 **전용 메신저 UI 미완료** |
| 친구 대전방 초대 백엔드 | **#90** | **병합 완료** (2026-10-29) | PG16 독립 연결 경합 CI 3종 통과, SQL 007 적용/실계정 수락·코드 참가 E2E 별도. 초대 발송/수신 UI 미완료 |
| 친구 요청·목록·차단 UI | **#96** | **병합 완료** (2026-10-29) | UI 모의 브라우저 178 tests/빌드; `FRIENDS_UI_ENABLED` **기본 OFF**, 운영 DB 005/E2E/환경변수 활성화 미확인 |
| 문서 정합성 1차 | **#101** | **병합 완료** (2026-10-29) | 당시 기준 2026-10-29 현황을 기록한 스냅샷 |
| 데스크톱 정보 밀도·내부 스크롤 | **#109** | **병합 완료** (2026-10-29) | PC 패널·프로필 2열·랭킹 배치 구현; 당시 실제 앱 해상도별/200% 확대 및 CI 실측 성공을 보고하지 않음 |
| 로비 카드·사이드바·이미지/버튼 간격 | **#117·#119·#121** | **모두 병합** | **#119에서 #117의 부정확한 버튼 하단 패딩·테두리 변경을 원복**. 카드/진행 중 경기 간격, 하단 둥근 이미지, 열 하단 높이 정렬은 후속 PR 구현 기준. 실제 로그인 브라우저 광범위 QA 별도 |
| 1920×1080 히어로 비율·타이포그래피 | **#123·#125** | **모두 병합** | 원본 3:1 비율과 넓은 화면 제목 최대 크기 조정; Chromium **재구성 fixture**만으로 스크롤/잘림 확인, 실제 앱 인증 로비 E2E 별도 |

## 2. Draft PR — 아직 main에 없는 기능

| 범위 | Draft PR / HEAD | 자동검사 근거 | 아직 미완료 |
| --- | --- | --- | --- |
| XP·레벨·게임 종료 보상 원장 | [#110](https://github.com/SuperNova080710/Alkkagi/pull/110) · `6efa6aa` | 42 테스트 파일 / **206 tests**, lint/typecheck/build 성공 | **SQL 008 미병합·운영 미적용**, Preview·실제 A/B·독립 PG16 동시 종료 경쟁 미검증; UI 없음 |
| 알·캐릭터 코스메틱 카탈로그·해금·장착 API | [#115](https://github.com/SuperNova080710/Alkkagi/pull/115) · `638c644` | 42 파일 / **205 tests**, lint/typecheck/build 성공 | **SQL 009 미병합·미적용**, 운영 A/B·동시 장착 E2E 미검증, 외형 이미지/장착 UI 없음; XP 008 선행 시 레벨 해금 |
| 기술 SEO (canonical·robots·sitemap·noindex) | [#131](https://github.com/SuperNova080710/Alkkagi/pull/131) · `09ab3d8` | 41 파일 / **198 tests**, lint/typecheck/build 성공 | Preview/Production 미배포, Search Console 소유권 인증·사이트맵 제출·실제 Google 색인 미진행 |

기술 SEO는 **코드가 준비됐다는 것**과 **Google 검색에 실제 노출·상위 노출됐다는 것**이 다릅니다. 공개 조작법·규칙·FAQ 및 홈 내부 링크는 [디자인 PR #137](https://github.com/SuperNova080710/Alkkagi/pull/137)에서 구현 제안됐으며 **열림·미병합**, 실제 브라우저/Production E2E 미검증입니다. `src/app/page.tsx`는 SEO #131의 metadata export와 #137의 링크 JSX를 모두 보존하도록 통합해야 합니다. 가이드가 실제 공개되면 사이트맵에 `/how-to-play` 등록을 SEO 이슈 #126에서 별도 확인하세요. Search Console 절차 문서는 [PR #131 브랜치](https://github.com/SuperNova080710/Alkkagi/blob/feat/seo-google-indexing/docs/google-search-seo.md)를 사용하며 main에는 아직 없습니다.

## 3. Supabase 운영 DB 및 배포의 정확한 경계

| SQL | GitHub 상태 | 마지막 확인된 운영 적용 상태 |
| --- | --- | --- |
| P1~P3 초기 SQL, AI 002, 플레이어 검색 003 | 병합 | 이전 제출/운영 확인 기록 존재 |
| `202610290004_security_room_create_limits.sql` | #69 병합 | **2026-10-29 조회에서 적용 이력 없음** |
| `202610290005_friends_v1.sql` | #76 병합 | **당시 미적용** |
| `202610290006_direct_messages_v1.sql` | #81 병합 | **당시 미적용** |
| `202610290007_room_friend_invites_v1.sql` | #90 **병합** | **당시 미적용** |
| `202610290008_xp_levels_v1.sql` | #110 **Draft** | main 미포함/운영 적용 미진행 |
| `202610290009_cosmetics_v1.sql` | #115 **Draft** | main 미포함/운영 적용 미진행 |

**운영 재점검 우선:** 실제 `schema_migrations` 적용 이력과 테이블/RPC/RLS/GRANT를 직접 다시 확인하세요. 004→005→006→007은 파일 번호 순서와 함수 의존성을 검증하고 적용해야 하며, 초대 007은 친구 005가 선행되어야 합니다. XP 008은 기존 경기/AI 테이블에 의존하고, 코스메틱 009는 레벨에 따라 008과 연동됩니다. 번호만으로 무조건 SQL을 재실행하지 마세요.

- **Vercel Free:** 2026-10-29 일일 배포 한도 소진/Preview 미생성이 보고됐습니다. GitHub Quality CI·로컬 `next build` 성공은 Vercel 최신 Deployment READY를 뜻하지 않습니다.
- 친구 UI는 main에 있지만 **`FRIENDS_UI_ENABLED=true` 운영 확인 전에는 준비 중 화면**입니다. 플래그는 UX 게이트일 뿐 서버 인증/RLS를 대체하지 않습니다.
- 경기 채팅(`match_messages`)과 친구끼리의 DM(`dm_messages`)은 다른 기능입니다. DM 서버 코드 병합은 메신저 화면 제공을 의미하지 않습니다.
- **ALEPH P3 실제 폼 접수/승인**은 [#3](https://github.com/SuperNova080710/Alkkagi/issues/3)에서 확인되지 않았습니다. [P2](p2-submission-2026-10-28.md)·[P3](p3-final-submission-2026-10-29.md) 과거 제출 문서는 당시 상태 그대로 유지합니다.

## 4. 개발 채팅 간 작업 소유권

- **시스템:** DB `supabase/**`, 서비스·권한 `src/lib/**`, `src/app/api/**`, 실제 경기/XP/RP 경계, SQL/HTTP/독립 PG16 테스트. PR #110/#115/#131을 별개 기능 브랜치로 관리.
- **UI/UX:** `src/components/**`, 페이지 JSX·렌더링, `src/app/arena.css`, 모바일/전체화면 실측, 친구/초대/XP/코스메틱 시각 UI. PC 밀도 #102·히어로 #122/#124·SEO 콘텐츠 #130 등.
- **문서(이 대화):** `README.md`, `plan.md`, `docs/**/*.md`, 이슈 본문/상태만 수정. 운영 SQL/환경변수/배포와 PR 병합 금지.
- **공유 경계:** `src/proxy.ts` matcher에 기존 `/players/:path*`, `/friends/:path*`, `/api/messages/:path*`, `/api/room-invites/:path*`를 보존하고 향후 XP/코스메틱 인증 API 경로를 충돌 없이 통합. SEO는 `src/app/layout.tsx` 및 홈의 **metadata export**만, 디자인은 같은 파일 JSX/스타일만 수정하도록 구분.
- **작업 방식:** 기능 단위 상위 이슈와 작업 가능한 세부 이슈 → 독립 브랜치 → 검증 가능한 커밋 → PR 작성 → 별도 리뷰 채팅에서 검토/병합. 별개 채팅은 최신 GitHub 이슈/PR을 통해 상태를 공유합니다.

## 5. 남은 후속 확인

1. **DB/보안 담당** [#16](https://github.com/SuperNova080710/Alkkagi/issues/16), [#62](https://github.com/SuperNova080710/Alkkagi/issues/62), [#65](https://github.com/SuperNova080710/Alkkagi/issues/65): 004~007 실제 적용/권한/누출 비밀번호 제한 및 실계정 악용·경쟁 검증.
2. **친구·초대/DM 통합** [#72](https://github.com/SuperNova080710/Alkkagi/issues/72), [#77](https://github.com/SuperNova080710/Alkkagi/issues/77), [#82](https://github.com/SuperNova080710/Alkkagi/issues/82), [#92](https://github.com/SuperNova080710/Alkkagi/issues/92): 005~007 실제 DB·두 계정 E2E·UI 활성화·DM/초대 전용 화면.
3. **UI 수용** [#102](https://github.com/SuperNova080710/Alkkagi/issues/102), [#118](https://github.com/SuperNova080710/Alkkagi/issues/118), [#122](https://github.com/SuperNova080710/Alkkagi/issues/122), [#124](https://github.com/SuperNova080710/Alkkagi/issues/124): 병합된 CSS/반응형 조정의 실제 앱 크기별·200% zoom·긴 데이터 접근 및 미세 스크롤 확인.
4. **신규 시스템 PR** [#110](https://github.com/SuperNova080710/Alkkagi/pull/110), [#115](https://github.com/SuperNova080710/Alkkagi/pull/115): 리뷰·병합 여부부터 결정하고 DB 008/009는 분리 승인 및 운영 검증. 신규 코스메틱 외형/XP UI는 후속 디자인 이슈 필요.
5. **SEO** [#131](https://github.com/SuperNova080710/Alkkagi/pull/131), [#130](https://github.com/SuperNova080710/Alkkagi/issues/130): 기술 SEO PR 리뷰, 배포 후 HTTP/robots/sitemap, Search Console 등록·URL 검사, 공개 규칙 안내 페이지 PR #137 검토 및 SEO 홈 메타데이터와 충돌 없이 통합.
6. **ALEPH** [#3](https://github.com/SuperNova080710/Alkkagi/issues/3): 최종 제출 접수 여부 확인 후 상태 정리.

## 근거 문서
- 이전 날짜의 [인수 현황](current-status-2026-10-29.md)은 역사적 스냅샷으로 보존합니다. **현재 상태는 이 문서가 우선합니다.**
- [친구 UI](friends-ui.md) · [친구 API](friends-api-v1.md) · [친구 초대](room-friend-invites-api-v1.md) · [DM API](direct-messages-api-v1.md).
- [데스크톱 밀도 변경](ui-density-2026-10-29.md) · [와이드 히어로 검증](ui-hero-wide-review-2026-10-29.md).
- **문서 정합성 기준은 GitHub PR 실제 merged_at/state 및 관련 CI 결과**입니다. 이 작업에서 브라우저 실계정 E2E·운영 SQL·Vercel 배포를 새로 실행하지 않았습니다.
