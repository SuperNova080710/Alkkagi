# 2026-11-11 GitHub 전체 이슈·PR 정합성 감사

> **스냅샷:** 2026-11-11 KST, GitHub 일반 이슈 REST API 전체 페이지 대조. Pull Request가 issue API에 함께 나타나는 특성을 고려하여 **일반 이슈만 집계**했습니다. 최신 GitHub 상태가 항상 우선합니다.
>
> **해결 기준:** 기능 구현 PR 실제 병합 + 통합된 릴리스 범위 확인 → 구현 이슈 `completed` 종료. 미병합 독립 PR이 통합 PR로 대체된 경우는 **통합 PR의 실제 병합**을 근거로 합니다. 운영 E2E·정책/보안·미출시 기능의 작업은 별도 OPEN 유지.

## 1. 집계

| 구분 | 건수 |
| --- | ---: |
| 일반 이슈 전체 | **215** |
| 현재 CLOSED | **186** |
| 현재 OPEN | **29** |
| 이번 2026-11-11 작업으로 추가 종료한 기존 구현/문서 이슈 | **48** |

기존 PR #228/#229의 문서 작업도 병합돼 있었는데 이슈 #216/#225/#227이 열린 상태로 남아 있어 이번에 정리했습니다. 반면 **현행 최신 `main`은 v0.4.1**이고, `develop`만의 #342/#343·아직 미병합 #344는 별도로 관리합니다.

## 2. 이번 종료 이슈 — 병합 근거/잔여 경계

각 이슈 맨 위에 최신 완료 범위·PR 근거와 운영 검증 분리 사유를 추가하고 `completed`로 종료했습니다. 아래는 작업 시작 이전부터 존재했던 **48건** 전체입니다.

| 이슈 | 이슈 제목 | 확인한 구현·릴리스 근거 |
| --- | --- | --- |
| [#216](https://github.com/SuperNova080710/Alkkagi/issues/216) | [Docs 11/03] 전체 이슈·PR·브랜치 상태 정리 및 운영 문서 현행화 | **근거:** 과거 문서 정리 PR #228과 RC 인수 PR #229 모두 2026-11-04 병합됨. 산출물·이슈 분류 작업 완료. 이번 11/11 최신화는 #346/#347/#348에서 별도 진행합니다. |
| [#217](https://github.com/SuperNova080710/Alkkagi/issues/217) | [v0.3.0 Epic] 알까기 + 오목 멀티게임 확장 및 릴리스 | **근거:** 오목 멀티게임 Epic의 설계 #231, 엔진 #230, DB #232, 일반전 #233/#242, AI #235/#238, 랭크 #240/#245, UI #239/#241/#256/#257 및 v0.3.0 Production 릴리스 PR #297 병합 완료. 이후 금수 추가는 #319/#320 및 v0.4.0으로 별도 적용됐습니다. 운영 A/B 재검증은 #194/#196 등에서 추적합니다. |
| [#218](https://github.com/SuperNova080710/Alkkagi/issues/218) | [v0.3.0 A] 멀티게임 아키텍처·릴리스 경계·라우팅 설계 | **근거:** 멀티게임 아키텍처·릴리스 경계 문서 PR #231가 develop에 병합됐고 v0.3.0 Release #297에서 실 구현 연결까지 확인됐습니다. |
| [#219](https://github.com/SuperNova080710/Alkkagi/issues/219) | [v0.3.0 B] 오목 15×15 자유룰 순수 엔진·테스트 | **근거:** 15×15 자유룰 순수 오목 엔진·단위 테스트 PR #230이 develop에 병합돼 v0.3.0 #297로 출시됨. 이후 신규 대국 흑 금수는 별도 #319/#320 및 v0.4.0에서 구현됐으며 당시 자유룰 구현을 소급 변경하지 않습니다. |
| [#220](https://github.com/SuperNova080710/Alkkagi/issues/220) | [v0.3.0 C] 오목 Supabase 스키마·RPC·권한·경합 검증 | **근거:** 오목 독립 DB·RLS·RPC PR #232 및 PG17 검증 PR #249/#250 병합, 운영 오목 SQL 001~006 적용 이력과 v0.3.0 Production #297 확인. SQL 재실행 금지. 운영 실계정 인수는 #196에 분리합니다. |
| [#221](https://github.com/SuperNova080710/Alkkagi/issues/221) | [v0.3.0 D] 오목 실시간 일반전·초대·채팅·재대결 | **근거:** 오목 일반전·채팅·재대결 서버 PR #233, 친구 초대 #242, UI 연동 #256 병합, v0.3.0 Production #297 포함. 운영 실계정 E2E는 #194/#196에서 별도 검증합니다. |
| [#222](https://github.com/SuperNova080710/Alkkagi/issues/222) | [v0.3.0 E] 오목 AI 연습 대전 | **근거:** 오목 3단계 AI 규칙·서버 대국 구현 PR #235/#238 및 프론트 #257 병합, v0.3.0 릴리스 #297에 포함. 운영 실사용 AI 3난이도 E2E는 기존 #194/#196에서 구분합니다. |
| [#223](https://github.com/SuperNova080710/Alkkagi/issues/223) | [v0.3.0 F] 오목 독립 랭크 매칭·RP·리더보드 | **근거:** 오목 독립 랭크 큐·Elo/RP/리더보드 PR #240, 공통 XP 지급 #245, 통합 PG17 검사 #250 병합, v0.3.0 Production #297 포함. 운영 재검증은 별도입니다. |
| [#225](https://github.com/SuperNova080710/Alkkagi/issues/225) | [Docs 216.1] develop 전체 최신 문서·운영/QA 인수 현행화 | **근거:** README/계획/CHANGELOG·전수 이슈 감사·기술 문서 최신화 PR #228가 develop에 병합됨. 새 버전 기준 정정은 #346/#348에서 별도 관리합니다. |
| [#227](https://github.com/SuperNova080710/Alkkagi/issues/227) | [Docs 216.3] v0.2.0 RC 브랜치 인수 문서 상태 정정 | **근거:** RC 인수 파일 정정 PR #229가 develop에 병합되어 당시의 작업 범위 완료. 0.4.1 현행 운영/출시 문서 최신화는 #348로 분리합니다. |
| [#234](https://github.com/SuperNova080710/Alkkagi/issues/234) | [UI v0.3.0] 오목 로비·보드·경기·AI·랭크 화면 계약 및 인수 | **근거:** 오목 UI 상위 작업의 로비 #239, 보드 #241, 일반전 #255/#256, AI·랭크 #257, Chromium #252 병합. v0.3.0 Production #297에 통합, 실제 운영 두 계정 QA는 #194/#196에 남깁니다. |
| [#236](https://github.com/SuperNova080710/Alkkagi/issues/236) | [UI #234.1] v0.3 오목/알까기 게임 선택·기능 게이트·로비 3D 카드 | **근거:** 게임 선택·로비 3D·기능 플래그 UI PR #239 병합 후 v0.3.0 릴리스 #297 통합. 오목의 현재 금수 정책은 이후 #320 구현분과 구분합니다. |
| [#237](https://github.com/SuperNova080710/Alkkagi/issues/237) | [UI #234.2] 오목 15×15 보드·키보드/스크린리더·반응형 UI | **근거:** 오목 15×15 접근성·키보드·반응형 보드 PR #241, 실제 Chromium 회귀 PR #252 병합 후 v0.3.0 #297 포함. 수동 실계정 확대 QA는 별도입니다. |
| [#243](https://github.com/SuperNova080710/Alkkagi/issues/243) | [UI #234.3] 오목 일반전 대기실·턴/착수·채팅·재대결 서버 연동 | **근거:** 오목 일반전 서버 연결/채팅/재대결 UI PR #256 병합, v0.3.0 #297 출시 완료. 두 사용자 연결 품질은 #194/#196의 운영 인수 영역입니다. |
| [#244](https://github.com/SuperNova080710/Alkkagi/issues/244) | [UI #234.4] 오목 AI·독립 랭크 화면과 전체 UI 실브라우저 인수 | **근거:** 오목 AI/랭크 전환·RP UI PR #257, 랭킹·AI 이후 수정 #287/#291/#292/#294 병합, v0.3.0 #297에 포함됐습니다. |
| [#248](https://github.com/SuperNova080710/Alkkagi/issues/248) | [v0.3.0 System QA] 오목 001~006 전체 PG17 마이그레이션·RLS·정산 통합 인수 | **근거:** 오목 001~006 PG17 전체 마이그레이션·RLS·정산 통합 검증 PR #249/#250 병합, v0.3.0 #297에 적용 이력 확인. 운영 SQL 재실행 금지. |
| [#251](https://github.com/SuperNova080710/Alkkagi/issues/251) | [UI QA] 오목 보드 실제 Chromium 키보드·320px·확대 레이아웃 검증 게이트 | 오목 보드 Chromium 키보드/320px/확대 QA 게이트 PR #252 병합. 이후 v0.3.0 #297과 0.3.1 #304 테스트 흐름에 포함. 실제 운영 계정/줌 E2E는 #194의 수용 항목. |
| [#253](https://github.com/SuperNova080710/Alkkagi/issues/253) | [UI 버그] 오목 보드 gridcell에서 Enter·Space 착수 미동작 | 오목 15×15 gridcell Enter·Space 착수는 키보드 입력 대응 PR #241 및 검증 PR #252로 처리돼 v0.3.0에 포함. 실제 스크린리더/실사용 검증은 #194와 구분. |
| [#254](https://github.com/SuperNova080710/Alkkagi/issues/254) | [UI #243.1] 오목 일반전 대기실·경기 UI 컴포넌트 사전 구축 (서버 독립) | 오목 일반전 대기실·경기·채팅 UI 사전 구현 PR #255 및 실제 서버 연결 PR #256 병합, v0.3.0 #297에 포함. |
| [#261](https://github.com/SuperNova080710/Alkkagi/issues/261) | [UI v0.3.0] 오목·알까기 로비/경기/결과 UX 통일 및 보드 높이 최적화 | 오목/알까기 로비·결과·판 크기 통일 PR #265, 릴리스 통합 #267, 충돌 해결 #278 및 추가 대기실/방 패널 #281 병합 후 v0.3.0 #297 출시. 운영 시각 인수는 #194에 분리. |
| [#262](https://github.com/SuperNova080710/Alkkagi/issues/262) | [UI #261.1] 오목 로비를 알까기 Hero·3모드 카드·우측 정보 구조로 전환 | 오목 Hero·3모드 카드 레이아웃 PR #265와 공통 높이/아이덴티티 통합 PR #278 병합, v0.3.0 #297 포함. 독립 PR #275는 중복 병합 방지를 위해 미병합 종료됐고 통합 PR #278이 정식 근거입니다. |
| [#263](https://github.com/SuperNova080710/Alkkagi/issues/263) | [UI #261.2] 오목 일반·랭크·AI 종료 결과를 알까기 방식 오버레이로 통일 | 오목 승패·무승부 결과 오버레이 PR #265 및 색감/동선 통합 #278 병합, 릴리스 #297 포함. 별도 PR #274는 통합 결과로 대체되어 미병합 종료된 것이며 누락이 아닙니다. |
| [#264](https://github.com/SuperNova080710/Alkkagi/issues/264) | [UI #261.3] 오목판 뷰포트 맞춤 축소·채팅/상태 배치·모바일 스크롤 QA | 오목 경기판 높이·미세 스크롤 Chromium 회귀 PR #265 및 통합 #278 병합, v0.3.0 #297 포함. 실제 사용자의 200% 브라우저 확대는 #194에서 별도 검증. |
| [#268](https://github.com/SuperNova080710/Alkkagi/issues/268) | [UI #261.4] 알까기·오목 공통 프로필·레벨·XP·아바타 표시 통일 | 두 게임 공통 프로필·아바타·레벨/XP UI는 별도 PR #271이 아닌 충돌 해결 **통합 PR #278**로 릴리스 브랜치에 병합, #297 정식 출시. 개별 #271은 중복 병합 방지로 닫힌 대체 PR. |
| [#269](https://github.com/SuperNova080710/Alkkagi/issues/269) | [System/UI #261.5] 멀티게임 친구·메신저·초대 공유 및 v0.3 Preview 기능 게이트 정합성 | 공통 친구·메신저·초대 게이트 연결은 독립 미병합 PR #272 대신 **통합 PR #278**에 보존해 v0.3.0 릴리스 #297에 반영했습니다. 실제 계정 접근 권한 E2E는 #194/#196 영역. |
| [#270](https://github.com/SuperNova080710/Alkkagi/issues/270) | [UI #261.6] 오목 일반전 대기실을 알까기 대기실 레이아웃·색상·플로우로 통일 | 오목 Waiting Room v2는 독립 미병합 PR #273 대체 통합 #278과 후속 다이얼로그·대기실 PR #281 병합, v0.3.0 #297 포함. 별도 PR #273 중복 병합하지 않음. |
| [#276](https://github.com/SuperNova080710/Alkkagi/issues/276) | [UI v0.3.0 Integration] PR #271~#275 충돌 없는 통합·권한 게이트 보존·동일 SHA CI | 기능 충돌 없는 로비·프로필·친구/메신저·오목 결과 통합은 #271~#275 대신 **PR #278로 일괄 통합·병합**, v0.3.0 #297 출시. 개별 PR 병합 여부와 최종 코드 포함을 구분했습니다. |
| [#277](https://github.com/SuperNova080710/Alkkagi/issues/277) | [UI v0.3.0] #262·#263·#264·#268·#269·#270 통합 충돌 해소 및 릴리스 QA | UI 여섯 영역 충돌해소·릴리스 QA PR #278 병합, 동일 SHA Quality·Chromium 7뷰포트·공개 10뷰포트 검증 기록 존재, v0.3.0 #297 릴리스. 로그인 두 계정/실제 Zoom200%는 별도 인수입니다. |
| [#279](https://github.com/SuperNova080710/Alkkagi/issues/279) | [UI v0.3.0] 일반전 방 생성 ArenaDialog를 알까기·오목 동일 2카드 형식으로 통일 | 알까기·오목 일반전 ArenaDialog 2카드 통일 PR #281 병합 후 v0.3.0 #297 반영. 실제 계정 테스트는 별도 #194에서 추적. |
| [#280](https://github.com/SuperNova080710/Alkkagi/issues/280) | [UI v0.3.0] 로비 진행 중인 경기 큰 패널 제거 및 복귀 링크 최소화 | 진행 중 경기가 없을 때 큰 패널 제거, 존재할 때 최소 복귀 링크 표시는 PR #281 병합 및 #297 배포에 포함됐습니다. |
| [#282](https://github.com/SuperNova080710/Alkkagi/issues/282) | [v0.3.0 UI] 선택한 게임별 상단 랭킹 링크 및 랭킹 화면 전환 | 선택 게임별 랭킹 메뉴/직접 전환 PR #285/#288 병합 및 v0.3.0 Production #297에 포함됐습니다. |
| [#284](https://github.com/SuperNova080710/Alkkagi/issues/284) | [v0.3.0 UI] 오목 AI 대전 로비에서 난이도 모달 선택 후 즉시 경기 진입 | 오목 AI 난이도 모달 선택 후 바로 대국 생성 PR #287 병합, v0.3.0 Production #297 포함. 후속 다시하기 문제도 #289/#291에서 별도로 해결. |
| [#289](https://github.com/SuperNova080710/Alkkagi/issues/289) | [v0.3.0 UI] 오목 AI 대전 종료 후 다시하기에서 난이도 선택창 재표시 | 오목 AI 종료 후 다시하기에서 난이도 모달을 재표시하는 PR #291 병합, v0.3.0 릴리스 #297 포함. |
| [#290](https://github.com/SuperNova080710/Alkkagi/issues/290) | [v0.3.0 UI] 오목 랭킹을 알까기 랭킹 페이지의 공통 레이아웃·색상으로 통일 | 오목/알까기 랭킹 공통 레이아웃 PR #292 병합, TOP100 가로 넘침 수정 #294 후속 병합, v0.3.0 Production #297 포함. |
| [#293](https://github.com/SuperNova080710/Alkkagi/issues/293) | [v0.3.0 UI] 오목 TOP 100 리더보드 가로 스크롤 제거 및 반응형 3열 통일 | 오목 TOP100 3열·승패무 보존·가로스크롤 방지 PR #294 병합, v0.3.0 Production #297 포함. Chromium 7뷰포트 검사 근거는 PR #294에서 확인됩니다. |
| [#295](https://github.com/SuperNova080710/Alkkagi/issues/295) | [Release v0.3.0] Preview 인수 완료 → main 정식 배포 및 운영 검증 | v0.3.0 정식 Production 배포 PR #297 main 병합, 릴리스 CI·운영 오목 SQL 적용·Vercel READY 근거 기록 완료. 이후 0.3.1 #304, 0.4.0 #330, 0.4.1 #336까지 릴리스됨. 실제 새 실계정 E2E·공식 tag/Release 미확인은 #338 등 운영 후속으로 분리합니다. |
| [#305](https://github.com/SuperNova080710/Alkkagi/issues/305) | [보안 후속] 오목 랭크전 Supabase RPC·RLS 경로에서도 채팅 차단 | **DB 보안 구현** PR #342가 2026-11-11 develop 병합 완료. 오목 랭크 메시지 INSERT RPC 차단과 기존 메시지 SELECT RLS 제한, 일반전 허용 및 일회용 PG17.11 검증 증빙 확인. 신규 SQL의 **Production 적용·Data API/Realtime 실검증은 완료 아님** — 릴리스 #345에서 처리합니다. 구현 이슈로 종료합니다. |
| [#306](https://github.com/SuperNova080710/Alkkagi/issues/306) | [SEO 콘텐츠] 공개 조작법 가이드의 AI 진입 흐름 및 title 정합성 수정 | 공개 조작법의 세 게임 AI 진입 설명 및 중복 사이트명 title 수정 PR #343가 2026-11-11 develop 병합 완료. 비로그인 가이드 HTTP·canonical/robots/sitemap과 Chromium 회귀 검증 기록 확인. **Production 미반영**이며 릴리스 #345에서 추적합니다. |
| [#308](https://github.com/SuperNova080710/Alkkagi/issues/308) | [v0.4.0 UI] 세 게임 공통 버튼·로비·랭킹 및 체스 화면 | 세 게임 공통 UI 상위 구현은 PR #318(알까기/오목 로비·랭크), #322(체스 로비/대국), #326(체스 대기실/AI)과 릴리스 #330에 포함. 기존 체스 온라인 후속·꾸미기는 #327/#323으로 분리합니다. |
| [#310](https://github.com/SuperNova080710/Alkkagi/issues/310) | [v0.4.0 시스템] 체스 규칙·일반전·AI·랭크전 구현 | 체스 시스템 상위 범위는 규칙 #317, 온라인 일반전 #321, 랭크·AI 통합 #322, 일반전 친구 초대 #326 병합 및 v0.4.0 릴리스 #330에 포함. 체스 온라인 재대결·채팅·공통 XP는 별도 #327/#339~#341로 열림 유지. |
| [#314](https://github.com/SuperNova080710/Alkkagi/issues/314) | [v0.4.0 UI] 체스 로비·대국 화면 및 세 게임 전환 연결 | 체스 로비·화면·3게임 이동 UI는 PR #322, 일반전/AI 흐름 #326, 이동 상태 #329, 온라인 종료 패널 #333을 통해 v0.4.0/#330 및 v0.4.1/#336에 배포됐습니다. 온라인 재대결/채팅/XP는 상위 후속 #327 및 하위 #339~#341이 계속 OPEN입니다. |
| [#315](https://github.com/SuperNova080710/Alkkagi/issues/315) | [v0.4.0 체스] 초대방·서버 착수·랭크 매칭 및 체스 RP 정산 | 체스 일반전 방·원자적 착수 PR #321, 체스 랭크·시간제/전용 RP 통합 PR #322, 친구 초대 PR #326 병합, v0.4.0 Release #330 포함. 온라인 채팅·양쪽 수락 재대결·공통 XP는 별도 #327/#339~#341로 추적합니다. |
| [#316](https://github.com/SuperNova080710/Alkkagi/issues/316) | [v0.4.0 UI] 공통 버튼·로비·대기실·랭킹 컴포넌트 정리 | 알까기/오목 공통 로비·랭킹 PR #318과 체스 로비/대기실 #322/#326 병합, v0.4.0 Release #330 포함. 체스 결과 공통 패널은 v0.4.1 PR #333으로 보완됐습니다. 실제 2인 시각 QA는 #309/#338. |
| [#319](https://github.com/SuperNova080710/Alkkagi/issues/319) | [오목 규칙] 흑 33 금수와 일반전·AI·랭크전 판정 범위 검토 | 오목 신규 대국 흑 33·44·장목 금수 PR #320 병합, v0.4.0 Production #330 포함. 기존 자유룰 경기 호환·일반/AI/랭크 서버 RPC 검증을 PR #320에서 수행. 운영 수동 A/B 검증은 #309/#338에 분리. |
| [#324](https://github.com/SuperNova080710/Alkkagi/issues/324) | [v0.4.0 UI] 체스 일반전·AI 흐름과 보드 안정화 | 체스 일반전 방 만들기/코드 참여·AI 난이도 재선택·8×8 판 안정화 PR #326 **Closes #324**로 병합돼 v0.4.0 Production #330에 반영됐습니다. 두 계정 실사용 QA는 #338에 분리. |
| [#325](https://github.com/SuperNova080710/Alkkagi/issues/325) | [v0.4.0 체스] 일반전 대기실 친구 초대와 수락 연결 | 체스 친구 초대·수락과 정원/차단/RPC 보호 PR #326 **Closes #325**로 병합, 운영 신규 chess_friend_invites SQL 적용 기록 및 v0.4.0 #330 확인. 재대결은 #341 별도. |
| [#328](https://github.com/SuperNova080710/Alkkagi/issues/328) | [v0.4.0 UI] 체스 기물 이동 애니메이션과 차례 표시 개선 | 체스 280ms 이동 모션·턴/오류 배너·모션 감소·캐슬링·승격 등 PR #329가 release/v0.4.0에 병합됐고 v0.4.0 Production #330 포함. Chromium 검증 기록은 PR #329에 있습니다. |
| [#332](https://github.com/SuperNova080710/Alkkagi/issues/332) | [v0.4.1 UI] 체스 일반전·랭크전 종료 결과 패널 통일 | 체스 온라인 일반전·랭크전 종료 결과 공통 패널 PR #333이 **Closes #332**로 병합, #336 v0.4.1 Production 출시 및 #337 develop 역반영 확인. 온라인 재대결 버튼은 별도 #341에서 구현 진행 중입니다. |

## 3. OPEN 유지 — 이유와 다음 인수

| 이슈 | 작업 | 계속 열어 둔 이유 |
| --- | --- | --- |
| [#3](https://github.com/SuperNova080710/Alkkagi/issues/3) | [P3] 재접속·품질·보안·최종 배포 검증 | ALEPH P3 플랫폼 최종 접수 및 보안 인수 미확인 |
| [#16](https://github.com/SuperNova080710/Alkkagi/issues/16) | [P3] 보안·성능·최종 배포·문서 | 성능·추가 보안/운영·P3 잔여 QA |
| [#62](https://github.com/SuperNova080710/Alkkagi/issues/62) | [Security S1] 운영 Supabase Advisor 권한 감사와 RPC 악용 방지 | RPC·Supabase Advisor 보안 심층 점검 |
| [#64](https://github.com/SuperNova080710/Alkkagi/issues/64) | [Security S1.2] Supabase Advisor 경고 23건 권한·위험 분류 문서화 | Advisor 경고 23건의 최신 운영 재점검 |
| [#65](https://github.com/SuperNova080710/Alkkagi/issues/65) | [Security S1.3] Supabase Auth 유출 비밀번호 보호 설정 결정 | Auth 유출 비밀번호 보호 Free 플랜 제약/관리자 결정 |
| [#126](https://github.com/SuperNova080710/Alkkagi/issues/126) | [SEO S1] Google 검색 색인 준비·canonical·사이트맵·검색 콘솔 인계 | Search Console 색인 결과·운영 모니터링 |
| [#144](https://github.com/SuperNova080710/Alkkagi/issues/144) | [Release R1] 버전 기반 브랜치 전략 및 수동 Preview 릴리스 체계 전환 | 브랜치 운영의 관리자 Required/Preview 정책 인수 |
| [#188](https://github.com/SuperNova080710/Alkkagi/issues/188) | [CI R6] 릴리스 후보 전체 통합 CI 게이트 — PG17·Supabase E2E·백업 복원 | RC 필수 GitHub CI/Ruleset 관리자 검증 |
| [#192](https://github.com/SuperNova080710/Alkkagi/issues/192) | [CI R6.1] main 비릴리스 PR 우회 방지 — 항상 실행되는 release-source-guard | main 비릴리스 PR 우회 방지 Required Check 강제 |
| [#194](https://github.com/SuperNova080710/Alkkagi/issues/194) | [UI QA] 전체화면→친구 초대→메신저→XP→코스메틱 순차 검증 및 통합 인수 | 실계정 전체 UI·200% 확대/모바일 QA |
| [#196](https://github.com/SuperNova080710/Alkkagi/issues/196) | [Ops R7] 운영 브라우저 A/B 인증·Realtime·일반전 XP E2E 인수 | 실제 두 계정 Auth·DM Realtime·XP/꾸미기 E2E |
| [#203](https://github.com/SuperNova080710/Alkkagi/issues/203) | [Release v0.2.0] RC 동결·필수 CI·배포 후 브라우저 E2E·Production 승격 | 과거 v0.2.0 운영 QA·공식 Release 기록 미완료 |
| [#206](https://github.com/SuperNova080710/Alkkagi/issues/206) | [Release v0.2.0 / 3] 배포 후 A/B 실사용·UI 인수·승인된 Production 릴리스 | 과거 v0.2.0 A/B E2E·Smoke 미완료 |
| [#211](https://github.com/SuperNova080710/Alkkagi/issues/211) | [Ops v0.2.0] Preview AI 발사·기권 500 — 서버 Supabase 인증키 범위 분리 | 구 v0.2.0 Preview AI 500 해결·키 권한 정리 미검증 |
| [#309](https://github.com/SuperNova080710/Alkkagi/issues/309) | [v0.4.0 QA] 체스 2계정 대전·공통 UI 회귀 및 릴리스 후보 검증 | v0.4.0 실제 2계정 체스/모바일 QA |
| [#312](https://github.com/SuperNova080710/Alkkagi/issues/312) | [v0.4.0 체스] 합법 수·특수 수·승패 및 무승부 판정 | FIDE 75수/합의 무승부 등 미검증 핵심 요구 |
| [#313](https://github.com/SuperNova080710/Alkkagi/issues/313) | [v0.4.0 체스] 난이도별 AI 대전 및 즉시 재시작 | 체스 AI 서버 권위·소유자/멱등 계약 미검증 |
| [#323](https://github.com/SuperNova080710/Alkkagi/issues/323) | [후속 기능] 오목 돌과 체스 기물 꾸미기 | Draft PR #354 구현, 미병합·운영 미출시 |
| [#327](https://github.com/SuperNova080710/Alkkagi/issues/327) | [체스 후속] 온라인 대국 종료와 일반전 공통 기능 정리 | 체스 재대결·채팅·XP 후속 상위 |
| [#338](https://github.com/SuperNova080710/Alkkagi/issues/338) | [v0.4.1 운영 인수] 실제 2계정 Smoke 및 공식 태그·Release 정리 | v0.4.1 실계정 Smoke·Git 태그/GitHub Release |
| [#339](https://github.com/SuperNova080710/Alkkagi/issues/339) | [체스 #327.3] 온라인 대국 종료 시 공통 경험치 반영 | 체스 온라인 XP Draft PR #349 미병합 |
| [#340](https://github.com/SuperNova080710/Alkkagi/issues/340) | [체스 #327.2] 일반전 참가자 전용 대국 채팅 | 체스 일반전 채팅 Draft PR #350 미병합 |
| [#341](https://github.com/SuperNova080710/Alkkagi/issues/341) | [체스 #327.1] 일반전 종료 후 양쪽 수락 재대결 | 체스 재대결 PR #344 미병합 |
| [#345](https://github.com/SuperNova080710/Alkkagi/issues/345) | [v0.4.2 Release] 오목 채팅 DB 보안·AI 안내·체스 재대결 통합 배포 | v0.4.2 준비 중, 신규 SQL/Preview/Production 승인 필요 |
| [#346](https://github.com/SuperNova080710/Alkkagi/issues/346) | [Docs 11/11] v0.4.1 기준 PR·이슈 전수 정리 및 운영 문서 최신화 | 이번 문서 PR 리뷰·병합 대기 |
| [#347](https://github.com/SuperNova080710/Alkkagi/issues/347) | [Docs #346.1] 병합 PR 기반 이슈 종료 판정과 남은 QA 분리 | 병합 PR 기준 이슈 분류 수행 기록 |
| [#348](https://github.com/SuperNova080710/Alkkagi/issues/348) | [Docs #346.2] v0.4.1 운영 문서·CHANGELOG·README·릴리스 인수 갱신 | 운영·릴리스 문서 PR 리뷰·병합 대기 |
| [#352](https://github.com/SuperNova080710/Alkkagi/issues/352) | [#323] 오목·체스 외형 카탈로그와 장착 권한 | 슬롯·카탈로그·소유권과 기존 계정 호환을 Draft PR #354에서 구현, 미병합 |
| [#353](https://github.com/SuperNova080710/Alkkagi/issues/353) | [#323] 오목·체스 미리보기와 대국 외형 표시 | 미리보기·대국 렌더링을 Draft PR #354에서 구현, 미병합 |

## 4. 병합되지 않은 PR 처리 원칙

다음은 **PR 상태와 제품 코드 포함 여부가 다른 대표 사례**입니다.

- [PR #271](https://github.com/SuperNova080710/Alkkagi/pull/271)~[#275](https://github.com/SuperNova080710/Alkkagi/pull/275): 각각 독립 PR은 미병합 종료. 대신 **[PR #278](https://github.com/SuperNova080710/Alkkagi/pull/278)이 충돌을 해결해 병합됐으며 v0.3.0 릴리스 [#297](https://github.com/SuperNova080710/Alkkagi/pull/297)에 포함**. #268/#269/#270 등의 구현 완료 판정은 #278 기준이며 #271~#275를 병합한 것으로 기록하지 않음
- [PR #246](https://github.com/SuperNova080710/Alkkagi/pull/246)·[#247](https://github.com/SuperNova080710/Alkkagi/pull/247): 미병합 종료, 오목 DB/API 구현은 후속 병합 PR #232/#233 및 통합 릴리스 #297로 확인
- [PR #208](https://github.com/SuperNova080710/Alkkagi/pull/208)·[#191](https://github.com/SuperNova080710/Alkkagi/pull/191): **병합이 아닌 CI 음성 프로브**. 기능 완료 PR로 취급하지 않음
- [PR #342](https://github.com/SuperNova080710/Alkkagi/pull/342)·[#343](https://github.com/SuperNova080710/Alkkagi/pull/343): `develop`에 병합되어 **#305/#306 구현 이슈 종료**, 그러나 **v0.4.1 Production에는 미반영**. 운영 인수는 #345
- [PR #344](https://github.com/SuperNova080710/Alkkagi/pull/344): `develop` 대상 **OPEN/미병합**, 따라서 #341·#327과 신규 운영 SQL 게이트는 OPEN

## 5. 최신 릴리스 포함 확인

| Production | 병합 PR | 핵심 기능 |
| --- | --- | --- |
| v0.2.0 | [#207](https://github.com/SuperNova080710/Alkkagi/pull/207) | 알까기 친구/DM/초대·XP·꾸미기 |
| v0.3.0 | [#297](https://github.com/SuperNova080710/Alkkagi/pull/297) | 오목 15×15 자유룰·AI·랭크·친구·통합 UX |
| v0.3.1 | [#304](https://github.com/SuperNova080710/Alkkagi/pull/304) | 오목 랭크 화면 미세 스크롤·앱 채팅 차단 |
| v0.4.0 | [#330](https://github.com/SuperNova080710/Alkkagi/pull/330) | 체스 일반/랭크/AI, 신규 오목 대국 금수, 세 게임 공통 화면 |
| v0.4.1 | [#336](https://github.com/SuperNova080710/Alkkagi/pull/336) | 체스 온라인 종료 공통 결과/사유 UI·재접속 |

[Vercel v0.4.1 Production](https://vercel.com/mallang1/alkkagi/9iKVkDCnu7bmuEaHqE9wotiPD2Kr) READY, `main` `d40e110` 확인. **배포 READY·격리 CI ≠ 운영 두 계정 E2E ≠ 공식 Git 태그/GitHub Release**. GitHub Releases 목록은 조회 당시 비어 있었고 태그는 별도로 미확인입니다.

## 6. 변경 경계와 원본 기록

- 과거 [2026-11-03 전체 감사](github-issue-audit-2026-11-03.md), [현재 인수](current-status-2026-11-11.md), [릴리스 v0.4.2 인계](release-v0.4.2-handoff.md)를 함께 확인합니다. 과거 파일은 해당 날짜 스냅샷으로 **보존**합니다.
- 운영 PostgreSQL 17.11의 기존 적용 이력을 문서화했지만 **이번 작업에서는 운영 DB에 연결해 SQL을 실행하지 않았습니다**.
- 이슈 상태 변경은 `completed` 근거가 확인된 구현 이슈에만 수행했습니다. QA·보안·FIDE/AI 남은 요구·릴리스/Tag·Preview 키 문제는 이슈가 계속 OPEN입니다.
- 기능 코드/환경변수/Vercel 설정/Preview/Production/기존 PR 병합에는 손대지 않았습니다.

## 7. 감사 도중 생성된 미병합 PR (2026-11-11)

본 문서의 **48건 구현 완료 종료**와는 별개로, 체스 온라인 공통 XP [#339](https://github.com/SuperNova080710/Alkkagi/issues/339) / [Draft PR #349](https://github.com/SuperNova080710/Alkkagi/pull/349), 체스 일반전 채팅 [#340](https://github.com/SuperNova080710/Alkkagi/issues/340) / [Draft PR #350](https://github.com/SuperNova080710/Alkkagi/pull/350)이 `develop` 대상 open 상태로 생성됐습니다. 체스 양측 수락 재대결 [#341](https://github.com/SuperNova080710/Alkkagi/issues/341) / [PR #344](https://github.com/SuperNova080710/Alkkagi/pull/344) 역시 open입니다.

**이 세 이슈는 해결됨으로 닫지 않습니다.** PR이 실제 병합되고 수용 기준이 충족됐다는 근거가 있어야 기능 구현 완료 판정이 가능하며, 운영 검증·v0.4.2 배포는 [#345](https://github.com/SuperNova080710/Alkkagi/issues/345)에 별도 기록합니다.

## 8. 최신 추가 이슈 반영 (2026-11-11, 문서 PR #351 보완)

- 11/11 최초 감사 뒤 [#352](https://github.com/SuperNova080710/Alkkagi/issues/352)(오목·체스 외형 카탈로그와 장착 권한)와 [#353](https://github.com/SuperNova080710/Alkkagi/issues/353)(미리보기·실제 대국 외형 표시)가 상위 [#323](https://github.com/SuperNova080710/Alkkagi/issues/323)의 세부 작업으로 생성됐습니다. [Draft PR #354](https://github.com/SuperNova080710/Alkkagi/pull/354)에서 두 작업을 구현했으며, 미병합 상태로 세 이슈 모두 OPEN입니다.
- 전체 일반 이슈는 **215건 / CLOSED 186건 / OPEN 29건**으로 갱신했습니다. 이번에 완료로 닫았던 기존 **48건**의 판정·근거는 그대로 유지합니다.
- #349·#350·#354는 v0.4.2 추가 후보입니다. 포함 여부는 [#345](https://github.com/SuperNova080710/Alkkagi/issues/345)에서 결정합니다.
