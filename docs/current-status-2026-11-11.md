# Alkkagi Arena — 2026-11-11 운영·개발·PR 인수 현황

> **기준 시각:** 2026-11-11 KST. GitHub 및 Vercel의 실제 조회 결과를 기록합니다. 이후 PR·배포·이슈가 추가될 수 있으므로 이 문서는 시점 스냅샷이며, 최신 판단은 연결된 GitHub/Vercel 기록을 우선합니다.
>
> **구분 원칙:** GitHub PR 병합 ≠ 릴리스 브랜치 포함 ≠ Vercel Production READY ≠ 운영 DB 마이그레이션 실제 적용 ≠ 두 계정 브라우저 E2E ≠ Git 태그·GitHub Release 발행. 한 단계의 성공을 다음 단계의 완료로 간주하지 않습니다.

## 1. 실서비스·브랜치·버전

| 구분 | 확인 상태 | 근거 / 인수 경계 |
| --- | --- | --- |
| 웹 서비스 | [alkkagi-alpha.vercel.app](https://alkkagi-alpha.vercel.app), Vercel Production **READY** | [Vercel 배포 `dpl_9iKVkDCnu7bmuEaHqE9wotiPD2Kr`](https://vercel.com/mallang1/alkkagi/9iKVkDCnu7bmuEaHqE9wotiPD2Kr): `main` SHA `d40e1101c32bb30143ca9728a248860376093d45`, 정식 도메인 alias 연결 |
| 현행 릴리스 | **v0.4.1 코드** | [PR #336](https://github.com/SuperNova080710/Alkkagi/pull/336) `main` 병합·배포, [PR #337](https://github.com/SuperNova080710/Alkkagi/pull/337) `develop` 역반영 |
| `main` | `d40e1101c32bb30143ca9728a248860376093d45` | Production 코드 기준; v0.4.2 변경은 미반영 |
| `develop` | `1fc3bf437a2d41d066afee8ff56009e6ac98e527` | [PR #342](https://github.com/SuperNova080710/Alkkagi/pull/342)·[#343](https://github.com/SuperNova080710/Alkkagi/pull/343) 병합됨. Production **미반영** |
| 진행 중 PR | [#344 체스 일반전 재대결](https://github.com/SuperNova080710/Alkkagi/pull/344) (`develop` 대상, 아직 미병합) | 개발 CI 기록은 있으나 독립 사용자 운영 E2E·SQL 적용·v0.4.2 릴리스 승인 전 |
| 예정 릴리스 | [v0.4.2 #345](https://github.com/SuperNova080710/Alkkagi/issues/345) | 개발/QA/운영 배포 준비 단계. **Production은 현재 v0.4.1 유지** |
| 공식 GitHub Release | GitHub Releases API 조회 결과 **0건** | 공식 `v0.4.1` Git tag의 존재·실제 두 계정 Smoke는 별도로 확인 필요([#338](https://github.com/SuperNova080710/Alkkagi/issues/338)). Release 목록이 비어 있다는 사실만으로 태그 부재를 단정하지 않음 |

## 2. 구현·릴리스 변동

| 버전 | 병합 근거 | 포함 기능 | 확인 경계 |
| --- | --- | --- | --- |
| v0.2.0 | [#207](https://github.com/SuperNova080710/Alkkagi/pull/207) | 친구·DM·초대, 레벨/XP, 꾸미기 및 QA 기반 통합 | 현재보다 오래된 릴리스 |
| v0.3.0 | [#297](https://github.com/SuperNova080710/Alkkagi/pull/297) | **오목 15×15 자유룰**, 일반전/친구 초대/채팅/재대결, 3단계 AI, 독립 랭크/RP·리더보드, 알까기·오목 공통 UI | 운영 오목 001~006 적용 이력·당시 Preview/Production 승인 기록 |
| v0.3.1 | [#304](https://github.com/SuperNova080710/Alkkagi/pull/304) | 오목 랭크전 미세 스크롤 개선, 랭크 채팅 UI/앱 API 비활성화 | **DB 직접 호출 차단까지 완료한 것은 아님**. DB 보완은 아래 #342 |
| v0.4.0 | [#330](https://github.com/SuperNova080710/Alkkagi/pull/330) | 체스 일반전 코드방·친구 초대·서버 착수, 체스 90초 랭크/RP, 세 난이도 AI, 이동 애니메이션·차례 표시, 공통 3게임 UI | 신규 오목 대국의 흑 33·44·장목 금수 도입([#320](https://github.com/SuperNova080710/Alkkagi/pull/320)); 기존 자유룰 대국은 종전 규칙 유지 |
| v0.4.1 | [#333](https://github.com/SuperNova080710/Alkkagi/pull/333), [#336](https://github.com/SuperNova080710/Alkkagi/pull/336) | 체스 일반전/랭크전의 서버 확정 승패·종료 사유·재접속 공통 결과 패널, 모드별 로비 복귀 | Quality **571 tests**, Chromium 10/10([#333](https://github.com/SuperNova080710/Alkkagi/pull/333)); 운영 두 계정 실측은 [#338](https://github.com/SuperNova080710/Alkkagi/issues/338) 미완료 |

**운영 기능 설명:** 알까기는 일반전·랭크전·AI·RP·친구/프로필/XP·알/캐릭터 꾸미기 기반입니다. 오목은 일반전·랭크전·AI·소셜 진입을 제공하며, 게임별 RP는 분리됩니다. 체스는 일반전·랭크전·AI 및 온라인 결과 패널이 구현됐습니다. **체스 일반전 양쪽 수락 재대결·대국 채팅·서버 확정 XP는 현재 출시 기능으로 안내하지 않습니다.**

## 3. 현재 `develop`만의 변화 / v0.4.2 STOP

- **[#342 오목 채팅 DB 경계](https://github.com/SuperNova080710/Alkkagi/pull/342)** — 원 이슈 [#305](https://github.com/SuperNova080710/Alkkagi/issues/305) 구현. 랭크전 메시지 INSERT RPC·과거 메시지 SELECT RLS 차단, 일반전 채팅 보존, 일회용 PostgreSQL 17.11 검증. 신규 SQL `supabase/migrations/20261111025029_omok_ranked_chat_boundary.sql`은 **develop에는 있으나 운영 SQL 적용·Data API/Realtime 검증을 아직 확인하지 않았습니다**. 이력 삭제·마이그레이션 재실행·독단적 운영 적용 금지.
- **[#343 공개 AI 조작법/title](https://github.com/SuperNova080710/Alkkagi/pull/343)** — 원 이슈 [#306](https://github.com/SuperNova080710/Alkkagi/issues/306) 구현. 알까기 AI는 연습방에서 난이도 선택, 오목/체스 AI는 로비에서 난이도 선택 후 바로 시작. 공개 가이드의 중복 페이지 제목 수정. **Production에 아직 없음**.
- **[#344 체스 양쪽 수락 재대결](https://github.com/SuperNova080710/Alkkagi/pull/344)** — 원 이슈 [#341](https://github.com/SuperNova080710/Alkkagi/issues/341). 종료 30분 이내 양측 수락→새 대국 1건, 색 교대, 중복 요청 보호, Chromium·격리 PG17 검사 기록. **PR 미병합**, 신규 `20261111025703_chess_casual_rematch.sql`도 운영 적용되지 않았으므로 v0.4.1 기능 아님.
- **후속 개발 중·미병합:** [#340 체스 일반전 채팅 / PR #350](https://github.com/SuperNova080710/Alkkagi/pull/350), [#339 체스 온라인 XP / PR #349](https://github.com/SuperNova080710/Alkkagi/pull/349), 상위 [#327](https://github.com/SuperNova080710/Alkkagi/issues/327). PR 제출은 구현 완료·`develop` 병합·Production 출시를 뜻하지 않습니다. [#323](https://github.com/SuperNova080710/Alkkagi/issues/323) 오목 돌·체스 기물 꾸미기는 새 세부 이슈 [#352 카탈로그/장착 권한](https://github.com/SuperNova080710/Alkkagi/issues/352)와 [#353 미리보기/대국 표시](https://github.com/SuperNova080710/Alkkagi/issues/353)로 분리됐으며 이번 v0.4.2 출시 대상에서 제외합니다.
- **릴리스 #345의 STOP:** 위 PR/SQL/테스트·기능 범위 확정 → 실제 운영 DB 상태·권한 검토 → 사용자 승인된 Preview/두 계정 QA → `release/v0.4.2` 필수 CI → 별도 `main`/Production 승인 및 배포 후 Smoke. 자동화 통과만으로 운영 E2E PASS나 승인으로 적지 않습니다.

## 4. 오래된 이슈를 닫는 기준

이번 [이슈 감사](github-issue-audit-2026-11-11.md)에서는 병합 PR 번호·통합 대체 PR·현재 릴리스 포함을 확인했습니다. 특히 독립 오목 UI PR #271~#275는 **미병합 종료**였지만, 동일 구현을 충돌 없이 결합한 **PR #278이 병합되어 v0.3.0에 포함**됐습니다. 따라서 이슈 #268/#269/#270 등을 구현 완료로 닫되, '개별 PR이 병합됐다'고 기록하지 않았습니다.

반대로 [#312](https://github.com/SuperNova080710/Alkkagi/issues/312)의 FIDE 75수·합의 무승부 등 세부 판정과 [#313](https://github.com/SuperNova080710/Alkkagi/issues/313)의 서버 권위 AI 소유자/재시도 계약은 PR #317/#322의 **실제 구현 범위와 완전히 일치한다고 단정할 증거가 없어 유지**합니다. [#309](https://github.com/SuperNova080710/Alkkagi/issues/309)·[#338](https://github.com/SuperNova080710/Alkkagi/issues/338)은 실제 두 계정/운영 릴리스 인수 미완료로 계속 열려 있습니다.

## 5. 운영·보안·SEO·검증 보류

- 운영 Supabase는 PostgreSQL **17.11**. 알까기 SQL 004~009(2026-11-02), 오목 001~006(v0.3.0), 이후 오목 금수/체스 일반·랭크·친구 초대(v0.4.0)의 적용 이력이 릴리스 PR에 보고돼 있습니다. **이미 적용된 SQL을 재실행하지 않습니다.** 새 SQL #342/#344는 이전 적용 기록과 분리합니다.
- [#338](https://github.com/SuperNova080710/Alkkagi/issues/338): 실제 v0.4.1 Production 두 계정 일반/랭크 체스 결과·재접속 Smoke와 공식 Git tag/Release 인수. [#194](https://github.com/SuperNova080710/Alkkagi/issues/194) UI 확대/모바일, [#196](https://github.com/SuperNova080710/Alkkagi/issues/196) 기존 두 계정 Auth/DM WebSocket/XP, [#309](https://github.com/SuperNova080710/Alkkagi/issues/309) 체스 통합 QA는 별도 미완료입니다.
- [#62](https://github.com/SuperNova080710/Alkkagi/issues/62)·[#64](https://github.com/SuperNova080710/Alkkagi/issues/64) Supabase Advisor/RPC 추가 감사, [#65](https://github.com/SuperNova080710/Alkkagi/issues/65) Auth 유출 비밀번호 보호 Free 플랜 제약은 기술 릴리스 PR이 병합됐다는 이유로 종료하지 않습니다.
- [#126](https://github.com/SuperNova080710/Alkkagi/issues/126): 검색 SEO 코드와 사이트맵은 이전 릴리스에 포함. 사용자의 Search Console 소유권 확인·사이트맵 성공 보고는 있으나 실제 색인/검색 성과와 구분합니다.
- [#188](https://github.com/SuperNova080710/Alkkagi/issues/188)·[#192](https://github.com/SuperNova080710/Alkkagi/issues/192): CI 구현 PR #190/#193 병합 후에도 GitHub `main` Ruleset Required 5종 적용·우회 방지 정책 관리 인수는 독립 작업입니다.
- [#3](https://github.com/SuperNova080710/Alkkagi/issues/3)·[#16](https://github.com/SuperNova080710/Alkkagi/issues/16): ALEPH P3 제출 실접수·보안/성능 인수 역사적 보류. 나중 버전으로 변경돼도 미확인 제출을 소급 완료 처리하지 않습니다.
- [#203](https://github.com/SuperNova080710/Alkkagi/issues/203)·[#206](https://github.com/SuperNova080710/Alkkagi/issues/206)·[#211](https://github.com/SuperNova080710/Alkkagi/issues/211) 등 예전 v0.2.0 운영/Preview 이슈는 현재 v0.4.1 실서비스 기준으로 재검증·중복 이관 필요. 실제 해결 근거 없이는 자동 폐쇄하지 않았습니다.

## 6. 문서·인수 링크

- [현재 README](../README.md) · [계획](../plan.md) · [CHANGELOG](../CHANGELOG.md) · [릴리스 운영 매뉴얼](release-process.md)
- [전체 이슈 종료/보류 근거](github-issue-audit-2026-11-11.md) · [v0.4.2 릴리스 인수 체크리스트](release-v0.4.2-handoff.md)
- [오목 0.3 아키텍처(역사적 설계)](v0.3.0-omok-architecture.md) · [이전 2026-11-03 스냅샷](current-status-2026-11-03.md) · [2026-10-30 스냅샷](current-status-2026-10-30.md)

**이번 문서화에서 운영 SQL·환경변수·Vercel 배포·기능 코드·실제 두 계정 쓰기 E2E는 실행하지 않았습니다. 문서 PR 병합·Production 출시 판단은 별도 검토 채팅 담당입니다.**

## 7. 최신 병렬 작업 PR 상태 (2026-11-11 KST)

- [체스 일반전 참가자 채팅 PR #350](https://github.com/SuperNova080710/Alkkagi/pull/350) — [#340](https://github.com/SuperNova080710/Alkkagi/issues/340) 후속 개발 PR이 `develop` 대상으로 **open/미병합**. 구현 PR의 존재만으로 Production 또는 사용자 E2E 완료를 선언하지 않습니다.
- [체스 온라인 경기 XP PR #349](https://github.com/SuperNova080710/Alkkagi/pull/349) — [#339](https://github.com/SuperNova080710/Alkkagi/issues/339) 후속 개발 PR이 `develop` 대상으로 **open/미병합**. 보상 중복·랭크 RP·PG17 운영 적용·실계정 검증을 따로 인수합니다.
- [체스 재대결 PR #344](https://github.com/SuperNova080710/Alkkagi/pull/344)도 **open/미병합**. 세 PR의 병합 여부와 v0.4.2 포함 범위는 릴리스 [#345](https://github.com/SuperNova080710/Alkkagi/issues/345)에서 검토합니다.

이 섹션은 같은 날 병렬 개발로 추가된 PR을 반영한 보충 기록입니다. 최신 PR 상태가 변경되면 GitHub가 우선합니다. 이번 작업에서는 해당 개발 PR을 병합하거나 신규 DB migration을 적용하지 않았습니다.
