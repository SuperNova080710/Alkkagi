# Alkkagi Arena — 2026-11-03 전체 개발·이슈·운영 인수

> **조회 기준:** 2026-11-03 KST. `main` `cd752f6bd335a518302595e2187b54717c9ddaea`(기존 v0.1.0 코드), `develop` `5c2180806910c1ffaf6881b9b948031cf0239729`, `release/v0.2.0` `434ea6dcb0c8ac2314e779c6775c2ee398189a5b`. GitHub 상태는 이후 변경 가능하며 링크된 각 이슈/PR이 최신 원천입니다.
>
> **중요:** 코드 병합, `release` Preview 검증, 운영 DB DDL, 브라우저 두 계정 E2E, `main` Production 릴리스는 **서로 다른 단계**입니다. 과거의 10월 30일 운영 SQL 미적용 기록은 당시 스냅샷일 뿐 현재 상태가 아닙니다.

## 1. 운영·릴리스 상태

| 구분 | 2026-11-03 확인 상태 | 남은 승인/검증 |
| --- | --- | --- |
| 운영 DB | Supabase PostgreSQL **17.11**, **2026-11-02 SQL 004~009 적용 완료**(운영 이슈 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155)·[#196](https://github.com/SuperNova080710/Alkkagi/issues/196) 근거). 마이그레이션 이력 총 18건/핵심 RPC·RLS·Realtime 읽기 전용 재점검 기록 | **재실행 금지**; 실제 사용 권한/이벤트/데이터 경계 검증은 별도 |
| 현재 Production 코드 | `main` `cd752f6`, 기존 v0.1.0 계열. `develop`과 RC 기능이 곧바로 운영 공개되는 것은 아님 | 승인된 RC 합격·main 병합/새 Production 배포 |
| v0.2.0 후보 | [Draft PR #207](https://github.com/SuperNova080710/Alkkagi/pull/207) `release/v0.2.0 → main`, 미병합. 소스 RC에는 최신 로비 XP 소형 카드 [#215](https://github.com/SuperNova080710/Alkkagi/pull/215)까지 포함 | [#203](https://github.com/SuperNova080710/Alkkagi/issues/203), [#206](https://github.com/SuperNova080710/Alkkagi/issues/206) 배포·실브라우저 E2E·최종 승인 |
| 릴리스 보호 | [#190](https://github.com/SuperNova080710/Alkkagi/pull/190) 4종 CI, [#193](https://github.com/SuperNova080710/Alkkagi/pull/193) release-source-guard 구현 병합. 비릴리스 main PR [#208](https://github.com/SuperNova080710/Alkkagi/pull/208)은 의도된 실패 검사용으로 미병합 종료 | 실제 `main` 보호 Required Checks 5종 등록/강제 검증은 [#188](https://github.com/SuperNova080710/Alkkagi/issues/188)·[#192](https://github.com/SuperNova080710/Alkkagi/issues/192) 및 RC에서 별도 확인 |
| QA | 격리된 PG17·로컬 Supabase Auth/Realtime·백업복원 CI 구현 병합(#171/#178/#185), hosted QA 페이지 PR [#198](https://github.com/SuperNova080710/Alkkagi/pull/198) 병합 | **실제 운영/Preview 브라우저 두 계정 A/B E2E 미완료**([#196](https://github.com/SuperNova080710/Alkkagi/issues/196)·[#194](https://github.com/SuperNova080710/Alkkagi/issues/194)) |
| Preview AI 장애 | [#211](https://github.com/SuperNova080710/Alkkagi/issues/211): RC Preview에서 AI 발사/기권 500; Preview 전용 `SUPABASE_SECRET_KEY` 미설정이 Runtime 로그에서 확인됨 | 운영 DB와 동일한 Preview에서 서비스 관리자 키 범위 확대는 **사용자 승인/환경 분리** 선행. 값·토큰을 이슈에 게시하지 말 것 |
| SEO | 기술 SEO #131 및 공개 가이드 #137 코드 병합 | 실제 Search Console 소유권·사이트맵 제출/색인 [#126](https://github.com/SuperNova080710/Alkkagi/issues/126) 별도 |
| ALEPH 제출 | P2/P3 과거 인수 자료 보존 | 최종 P3 플랫폼 접수/승인은 [#3](https://github.com/SuperNova080710/Alkkagi/issues/3)에서 미확인 |

## 2. 현재 코드 구현과 사용자 기능

| 기능 | 구현 근거 | 사용자/운영 수용 경계 |
| --- | --- | --- |
| P1~P3 일반/랭크·턴/채팅/재도전·AI 연습전 | #17~#48 병합 및 과거 P3 스냅샷 | v0.2.0 실제 브라우저/AI 난이도 확인 [#194](https://github.com/SuperNova080710/Alkkagi/issues/194)·[#211](https://github.com/SuperNova080710/Alkkagi/issues/211) |
| 목재·유리알 UI 및 PC/모바일 시각 보완 | #61/#66/#68/#70/#71, #109/#119/#121/#123/#125/#189/#197/#200/#202 | 최신 통합/실기기·실계정 화면 검증 [#194](https://github.com/SuperNova080710/Alkkagi/issues/194) |
| 친구 요청·목록·차단 | API #76, UI #96 병합 | `FRIENDS_UI_ENABLED` 기능 플래그·실제 두 계정 E2E |
| 친구 DM·읽음 | API #81, 화면 #143 병합 | `FRIENDS_UI_ENABLED` + `MESSAGES_UI_ENABLED` 명시적 게이트, 실제 WebSocket INSERT·RLS E2E |
| 친구 대전방 초대·일반전 3D 대기실 | API #90, UI #181 병합 | `ROOM_INVITES_UI_ENABLED` 및 친구 게이트, 실계정 수락/만료/좌석 경쟁 QA |
| XP/레벨 원장·프로필·로비 미니카드 | 백엔드 #110, 프로필 UI #159, 로비 UI [#214](https://github.com/SuperNova080710/Alkkagi/pull/214) `develop` 병합, RC 반영 [#215](https://github.com/SuperNova080710/Alkkagi/pull/215) | `EXPERIENCE_UI_ENABLED` 기본 OFF/승인된 QA에서만 ON; 실제 지급/레벨/공개 설정 E2E |
| 알/캐릭터 인벤토리·장착·게임판 외형 | 백엔드 #115, 인벤토리 #167, 게임판 #173 병합 | `COSMETICS_UI_ENABLED` 및 6종 에셋/공개 설정·실계정 E2E |
| 로비·프로필 기능 상태 문구 | `release` #210, `develop` #212 병합 | ON/OFF 실제 QA와 최신 RC 화면 반영 [#194](https://github.com/SuperNova080710/Alkkagi/issues/194) |

**기능 플래그 기본 정책:** 단순 코드 존재나 SQL 적용만으로 UI 활성화·운영 공개를 주장하지 않습니다. QA용 `OPS_TWO_ACCOUNT_QA_ENABLED`는 별도 서버측 A/B allowlist와 함께 설정하며, 승인 전에는 404로 유지합니다.

## 2-1. 차기 v0.3.0 계획 — 오목 멀티게임 분리 (2026-11-03 추가)

기존 v0.2.0 RC는 별도로 **동결/출시 승인 대기**이며, 새 기능은 [v0.3.0 Epic #217](https://github.com/SuperNova080710/Alkkagi/issues/217)과 하위 **#218~#224**에서 `develop` 기준으로만 진행합니다.

- **오목 15×15 자유룰**(5목 이상 승리, 흑 선공, 금수·무르기 없음)을 두 번째 게임으로 추가하는 목표. 알까기 물리·기존 RP/데이터를 변경하지 않고 새로운 오목 엔진/스키마/Realtime·UI/랭크/AI를 분리합니다.
- 설계 [Draft PR #231](https://github.com/SuperNova080710/Alkkagi/pull/231)과 순수 오목 엔진 [Draft PR #230](https://github.com/SuperNova080710/Alkkagi/pull/230)은 **현재 검토 중·미병합**입니다. 오목 실제 경기/랭크/AI는 지금 서비스에 구현·배포 완료된 기능이 아닙니다.
- #220 DB/RLS·#221 2인 오목·#222 AI·#223 독립 RP·#224 로비 및 v0.3.0 RC/QA도 모두 후속 작업입니다.
- `v0.2.0` Draft [#207](https://github.com/SuperNova080710/Alkkagi/pull/207)의 Production 승인·Preview 실사용 E2E를 오목 개발 계획으로 대체하거나 생략하지 않습니다.

## 3. 품질 검사 단계별 경계

- **자동화 구현/병합 확인:** PostgreSQL 17 SQL 004~009 일회용 적용 [#171](https://github.com/SuperNova080710/Alkkagi/pull/171); Docker 기반 Supabase Auth·JWT·Realtime [#178](https://github.com/SuperNova080710/Alkkagi/pull/178); 격리 `pg_dump → pg_restore` [#185](https://github.com/SuperNova080710/Alkkagi/pull/185); 릴리스 소스/CI 정책 #190/#193.
- **실제 QA 보조 구현/병합 확인:** 두 계정 브라우저 인수 경로 #198, 공개 viewport 자동화 #197, 친구 초대 SSR·터치 영역 #200, 통합 UI 회귀 #202. 통과한 자동화는 실제 운영 로그인·브라우저/서비스키 설정 검증을 대체하지 않습니다.
- **남은 승인형 시험:** Vercel Preview 환경·키 범위·QA 플래그, 두 사용자 로그인/친구/DM/초대/일반전 1판·XP·꾸미기·AI 발사 및 기권. 승인된 한정 테스트 이외 운영 데이터 변경/대량 시도/권한 확대 금지.
- **브랜치/버전 규칙:** 기능·문서 PR → `develop`; 검증된 `release/vX.Y.Z` RC 수동 Preview → 사용자 승인 뒤 `main` Production. RC #207은 아직 Draft이므로 `v0.2.0` Production 출시/태그 발행 완료라고 쓰지 않습니다.

## 4. 이슈 종료 기준 및 후속 책임

이슈 닫기는 **구현·문서·CI 산출물이 GitHub PR로 병합되고 해당 이슈의 개발 수용 범위가 끝났을 때만** 수행합니다. 이미 완료된 구현의 미비한 실제 운영 QA는 별도로 열린 [#194](https://github.com/SuperNova080710/Alkkagi/issues/194)·[#196](https://github.com/SuperNova080710/Alkkagi/issues/196)·[#203](https://github.com/SuperNova080710/Alkkagi/issues/203)·[#206](https://github.com/SuperNova080710/Alkkagi/issues/206) 등에 연결해 보존합니다. 삭제된 브랜치만으로 완료를 추정하거나, 열려 있는 RC PR을 무단 병합하지 않습니다.

**열린 의사결정/사용자 의존성:** Supabase Auth Free 설정 [#65](https://github.com/SuperNova080710/Alkkagi/issues/65), 보안 심층 점검 [#62](https://github.com/SuperNova080710/Alkkagi/issues/62), Search Console [#126](https://github.com/SuperNova080710/Alkkagi/issues/126), main Required Checks [#188](https://github.com/SuperNova080710/Alkkagi/issues/188)·[#192](https://github.com/SuperNova080710/Alkkagi/issues/192), E2E [#196](https://github.com/SuperNova080710/Alkkagi/issues/196), 릴리스 [#203](https://github.com/SuperNova080710/Alkkagi/issues/203)·[#206](https://github.com/SuperNova080710/Alkkagi/issues/206)·[#211](https://github.com/SuperNova080710/Alkkagi/issues/211).

## 5. 관련 문서

- [릴리스 운영 절차](release-process.md) · [v0.2.0 RC 원본](https://github.com/SuperNova080710/Alkkagi/blob/release/v0.2.0/docs/release-v0.2.0-rc.md) · [Changelog](../CHANGELOG.md)
- [운영 PG17 사전점검](db-rollout-preflight.md) · [PG17 전체 마이그레이션](pg17-migration-rollout.md) · [로컬 Supabase E2E](supabase-local-e2e.md) · [PG17 백업복원](pg17-backup-restore.md)
- [hosted 두 계정 QA](hosted-two-account-e2e.md) · [UI 통합 QA](integrated-ui-qa-2026-11-02.md) · [릴리스 통합 CI](release-integration-ci-gates.md)
- [XP 프로필 UI](experience-ui-v1.md) · [코스메틱 UI](cosmetics-ui-v1.md) · [게임판 코스메틱](match-cosmetics-ui-v1.md) · [방 초대 UI](room-invites-ui-v6.md)
- 이전 [2026-10-30](current-status-2026-10-30.md) 및 [2026-10-29](current-status-2026-10-29.md) 문서는 **해당 시점의 스냅샷**이며, 최신 운영 판단에는 이 문서를 우선합니다.

**이번 문서 작업 자체에서는 기능 코드/운영 DB/환경변수·Vercel 배포/Production 릴리스나 새로운 E2E를 실행하지 않았습니다.**
