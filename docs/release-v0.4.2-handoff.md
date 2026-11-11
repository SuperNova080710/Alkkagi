# v0.4.2 릴리스 인수 — 준비 체크리스트 (2026-11-11)

> **상위:** [Release #345](https://github.com/SuperNova080710/Alkkagi/issues/345), 체스 후속 [#327](https://github.com/SuperNova080710/Alkkagi/issues/327). **현재 Production은 v0.4.1**(SHA `d40e110`, [Vercel READY](https://vercel.com/mallang1/alkkagi/9iKVkDCnu7bmuEaHqE9wotiPD2Kr)). 이 문서는 릴리스 실행/승인을 의미하지 않습니다.

## 1. 소스·포함 범위

| 작업 | 구현 상태 | v0.4.2 범위 |
| --- | --- | --- |
| 오목 랭크전 DB 채팅 차단 | [PR #342](https://github.com/SuperNova080710/Alkkagi/pull/342) `develop` 병합 | 기존 계획 |
| 공개 AI 조작법·title | [PR #343](https://github.com/SuperNova080710/Alkkagi/pull/343) `develop` 병합 | 기존 계획, 신규 SQL 없음 |
| 체스 일반전 양쪽 수락 재대결 | [#341](https://github.com/SuperNova080710/Alkkagi/issues/341) / [Draft PR #344](https://github.com/SuperNova080710/Alkkagi/pull/344) 미병합 | 기존 계획, 리뷰·병합 대기 |
| 체스 온라인 XP | [#339](https://github.com/SuperNova080710/Alkkagi/issues/339) / [Draft PR #349](https://github.com/SuperNova080710/Alkkagi/pull/349) 미병합 | 추가 포함 여부 미확정 |
| 체스 일반전 채팅 | [#340](https://github.com/SuperNova080710/Alkkagi/issues/340) / [Draft PR #350](https://github.com/SuperNova080710/Alkkagi/pull/350) 미병합 | 추가 포함 여부 미확정 |
| 오목 돌·체스 기물 꾸미기 | [#323](https://github.com/SuperNova080710/Alkkagi/issues/323), [#352 카탈로그·장착](https://github.com/SuperNova080710/Alkkagi/issues/352), [#353 미리보기·대국 표시](https://github.com/SuperNova080710/Alkkagi/issues/353) 구현 [Draft PR #354](https://github.com/SuperNova080710/Alkkagi/pull/354) 미병합 | 추가 포함 여부 미확정 |

최종 포함 PR과 RC SHA는 #345에 기록합니다. 위 변경은 모두 v0.4.1 Production 미반영 상태입니다.

## 2. SQL 적용 사전 차단

아래는 검증 대상 후보 최대 5개의 타임스탬프 순서입니다. 실제 적용 목록은 **포함이 확정되고 해당 SQL이 RC에 있으며 운영 적용 이력에 없는 파일**로 확정합니다.

| 순서 | 후보 SQL (`supabase/migrations/`) | PR 및 범위 | 운영 적용 전 확인 |
| --- | --- | --- | --- |
| 1 | `20261111025029_omok_ranked_chat_boundary.sql` | #342 · 기존 계획 | 랭크 INSERT RPC·과거 메시지 SELECT 제한, 일반전 권한·Realtime 유지, 기존 행 보존 |
| 2 | `20261111025703_chess_casual_rematch.sql` | #344 · 기존 계획, 미병합 | 독립 PG17 연결의 동시 수락·새 대국 한 건 생성, 비참가자 거부, 원본 기보·결과 보존 |
| 3 | `20261111033733_chess_online_xp.sql` | #349 · 추가 포함 미확정 | 종료 보상 중복 방지, 세 게임 공통 일일·동일 상대 상한의 경합, RP 독립, 기존 종료 대국 소급 지급 방지 |
| 4 | `20261111033735_chess_casual_chat.sql` | #350 · 추가 포함 미확정 | 참가자 전용 조회·쓰기, 일반전 한정, Realtime·재접속, 재시도 중복 방지, 대국별 기록 분리 |
| 5 | `20261111050715_omok_chess_cosmetics.sql` | #354 · 추가 포함 미확정 | 기존 알·캐릭터 장착값 보존, 신규 슬롯 기본값·레벨 해금, 소유·슬롯 검증, 비공개·미발행 외형 대체 |

- [ ] **범위·이력 확정:** #345의 포함 PR과 RC SHA에 맞춰 SQL 목록을 동결합니다. 운영 PostgreSQL 버전, 적용 이력, 실제 스키마·RLS/GRANT·Realtime publication을 읽기 전용으로 확인합니다. 알까기 004~009, 오목 001~006, 오목 금수·체스 일반/랭크·친구 초대 등 이미 적용된 SQL은 재실행하지 않습니다.
- [ ] **통합 재생:** RC의 확정 SQL을 기존 스키마 위에서 타임스탬프 오름차순으로 일회용 PG17에 적용합니다. 적용 로그에 확정 SQL이 모두 있는지 확인하고, 선행 의존성, 기존 v0.4.1 코드 호환성, 데이터 보존, 백업·복구 및 Auth/Realtime 검증 결과를 RC SHA에 남깁니다. #344의 독립 연결 검증은 [PG17 CI](https://github.com/SuperNova080710/Alkkagi/actions/runs/42955445328)에 있습니다.
- [ ] **운영 적용 STOP:** 범위 미확정, PR 미병합, RC에 파일 없음, 이력 불일치, 통합 검증 실패 또는 운영 승인 전에는 해당 SQL 적용을 보류합니다. 승인된 미적용 파일만 위 순서로 각 1회 적용하고 파일명·결과를 #345에 기록합니다.
- [ ] 운영 SQL 적용 후 2계정 테스트는 승인한 소량의 테스트 데이터만 생성하고, 실제 메시지·회원 정보·토큰을 이슈/로그에 공개하지 않기

## 3. 사용 시나리오별 QA

- [ ] **오목 일반전:** A/B 일반전 생성·참가·채팅 GET/POST·Realtime 수신/재접속 정상, 차단·제3자 요청 거부
- [ ] **오목 랭크전:** 참여자도 DB RPC로 INSERT 불가, 과거 랭크 메시지 SELECT 불가. 기존 메시지 삭제하지 않음. 앱 API 403과 직접 SQL/RPC·RLS 결과를 분리해 기록
- [ ] **가이드:** 비로그인 `/how-to-play` HTTP 200, 알까기 연습방 AI와 오목/체스 로비 AI 설명 일치, HTML 최종 title 서비스명 한 번, canonical·robots·sitemap 유지
- [ ] **체스 재대결:** 일반전 서버 확정 종료 → A 수락 1/2 → B 수락 2/2 → 두 사용자 동일 새 대국 ID, 색 교대·기존 FEN/기보/결과 보존. 중복 버튼/두 연결 동시 POST/재접속/비참가자·랭크전 거부
- [ ] **체스 온라인 XP (포함 시):** 일반전·랭크전 종료 후 두 계정의 보상 및 프로필 반영, 중복 정산 방지, 알까기·오목·체스 공통 상한과 RP 정산 회귀 확인
- [ ] **체스 일반전 채팅 (포함 시):** A/B 양방향 Realtime 수신, 재접속·재시도, 제3자와 랭크전 접근 거부, 대국별 채팅 분리 확인. 재대결이 함께 포함되면 새 대국이 빈 기록에서 시작하는지 확인
- [ ] **오목 돌·체스 기물 꾸미기 (포함 시):** 기본·레벨 해금 외형 미리보기/장착, 일반전·랭크전·AI의 내 외형, 일반전 공개 상대 외형 및 비공개·랭크·AI 상대의 기본 외형, 모바일·고대비·미발행 외형 대체 확인
- [ ] **체스 기존 3모드:** 일반전·랭크전 결과 패널/로비 복귀, 90초 턴·RP 정산·3난이도 AI, 체크·캐슬링·승격·키보드, 모션 감소 설정 회귀
- [ ] **알까기·오목 기존 기능:** 일반/랭크/AI·친구/XP/꾸미기 회귀, 오목 기존 자유룰 대국 보존과 새 대국 흑 33/44/장목 금수
- [ ] 모바일 320/390, 태블릿 768, 데스크톱 1280/1920, 브라우저 실제 200% 확대, 버튼/패널/게임판 잘림·가로/미세 세로스크롤·접근성 확인

## 4. 브랜치·릴리스 단계

1. [ ] #345의 확정 범위와 `develop` 병합 상태를 대조한 뒤 `release/v0.4.2` 생성. RC SHA의 PR·SQL 목록을 확인하고 `package.json`/lockfile 버전·CHANGELOG·인수 문서를 맞춤
2. [ ] Quality (lint/typecheck/Vitest/Next build), PostgreSQL 17 통합·백업/복원·Supabase Auth/Realtime·release-source-guard 및 관련 Chromium QA를 **해당 RC 최신 SHA**에서 확인. 기능 Draft에서 건너뛴 릴리스 워크플로는 RC에서 실행 결과 확인
3. [ ] 무료 Vercel Preview 횟수를 최소화하고, 사용자가 승인한 Preview 환경/DB 연결·쓰기 범위에서 실제 A/B E2E 진행. Production 비밀을 전체 Preview에 확장하지 않기
4. [ ] 결과와 실패 재현을 #345/상세 기능 이슈에 기록. 실패 시 RC 브랜치 보완·CI/Preview 재검증
5. [ ] **사용자 별도 운영 변경·Production 승인 후** 확정 SQL을 §2 순서대로 적용하고 `release/v0.4.2 → main` PR을 병합. Production READY·실제 배포 SHA/alias/HTTP/API·런타임 오류 Smoke 확인
6. [ ] 실제 사용 E2E와 공식 Git 태그/GitHub Release 발행 여부를 각각 기록, `develop` 변경 역반영·불필요한 Preview 키/플래그 정리

## 5. 인수 사실과 금지

2026-11-11 기준 #342·#343은 `develop`에만 병합됐으며 #344·#349·#350·#354는 Draft로 열려 있습니다. v0.4.2 Preview·Production 배포와 운영 신규 SQL 적용은 확인되지 않았습니다. 이 문서 PR은 GitHub의 릴리스 인수 자료만 갱신합니다.
