# v0.4.2 릴리스 인수 — 준비 체크리스트 (2026-11-11)

> **상위:** [Release #345](https://github.com/SuperNova080710/Alkkagi/issues/345), 체스 후속 [#327](https://github.com/SuperNova080710/Alkkagi/issues/327). **현재 Production은 v0.4.1**(SHA `d40e110`, [Vercel READY](https://vercel.com/mallang1/alkkagi/9iKVkDCnu7bmuEaHqE9wotiPD2Kr)). 이 문서는 릴리스 실행/승인을 의미하지 않습니다.

## 1. 소스·포함 범위

| 작업 | 구현 상태 | 인수 게이트 |
| --- | --- | --- |
| 오목 랭크전 DB 채팅 차단 | [PR #342](https://github.com/SuperNova080710/Alkkagi/pull/342) `develop` 병합 | 운영 적용 전 SQL/권한/기존 데이터·Realtime 호환, 일반전 보존 |
| 공개 AI 조작법·title | [PR #343](https://github.com/SuperNova080710/Alkkagi/pull/343) `develop` 병합 | 공개 /how-to-play·SEO/robots/canonical·모바일 Preview 확인 |
| 체스 일반전 양쪽 수락 재대결 | [PR #344](https://github.com/SuperNova080710/Alkkagi/pull/344) **미병합** · [#341](https://github.com/SuperNova080710/Alkkagi/issues/341) | PR 최신 SHA 리뷰, 독립 PG17 경합·RLS, 두 계정 브라우저 실제 수락·재접속 검증 |
| 체스 일반전 채팅 | [#340](https://github.com/SuperNova080710/Alkkagi/issues/340) / [Draft PR #350](https://github.com/SuperNova080710/Alkkagi/pull/350) **미병합** | 참여자/RLS·Realtime/기존 대국 호환 CI 및 두 계정 QA, v0.4.2 포함 여부 승인 필요 |
| 체스 온라인 XP | [#339](https://github.com/SuperNova080710/Alkkagi/issues/339) 별도 미구현 | 중복 지급·랭크 RP 격리 검증 전 출시 기능으로 표기 금지 |
| 오목 돌/체스 기물 꾸미기 | [#323](https://github.com/SuperNova080710/Alkkagi/issues/323) 후속 | 범위 밖으로 유지. 현재 일반 알·캐릭터 꾸미기와 구별 |

## 2. SQL 적용 사전 차단

- [ ] **기존 적용 이력 읽기 전용 확인:** 알까기 004~009, 오목 001~006, 오목 신규 대국 금수·체스 일반/랭크·친구 초대는 이전 릴리스에서 적용된 상태로 기록. 해당 migration **재실행 금지**
- [ ] 신규 `20261111025029_omok_ranked_chat_boundary.sql` 적용 여부 및 정확한 운영 환경 조회. 대상/권한/스키마/Realtime 구독 영향과 백업·복구 범위를 검토
- [ ] 체스 재대결 PR #344가 병합되었다면 `20261111025703_chess_casual_rematch.sql` 신규 적용 선후관계·행 잠금·RLS/GRANT/데이터 보존 검토. **PR 미병합이면 운영 SQL 적용 금지**
- [ ] 사용자가 운영 변경을 명시 승인하기 전까지 Supabase SQL·RLS·JWT/서비스 키·Vercel 설정 변경 금지
- [ ] 운영 SQL 적용 후 2계정 테스트는 승인한 소량의 테스트 데이터만 생성하고, 실제 메시지·회원 정보·토큰을 이슈/로그에 공개하지 않기

## 3. 사용 시나리오별 QA

- [ ] **오목 일반전:** A/B 일반전 생성·참가·채팅 GET/POST·Realtime 수신/재접속 정상, 차단·제3자 요청 거부
- [ ] **오목 랭크전:** 참여자도 DB RPC로 INSERT 불가, 과거 랭크 메시지 SELECT 불가. 기존 메시지 삭제하지 않음. 앱 API 403과 직접 SQL/RPC·RLS 결과를 분리해 기록
- [ ] **가이드:** 비로그인 `/how-to-play` HTTP 200, 알까기 연습방 AI와 오목/체스 로비 AI 설명 일치, HTML 최종 title 서비스명 한 번, canonical·robots·sitemap 유지
- [ ] **체스 재대결:** 일반전 서버 확정 종료 → A 수락 1/2 → B 수락 2/2 → 두 사용자 동일 새 대국 ID, 색 교대·기존 FEN/기보/결과 보존. 중복 버튼/두 연결 동시 POST/재접속/비참가자·랭크전 거부
- [ ] **체스 기존 3모드:** 일반전·랭크전 결과 패널/로비 복귀, 90초 턴·RP 정산·3난이도 AI, 체크·캐슬링·승격·키보드, 모션 감소 설정 회귀
- [ ] **알까기·오목 기존 기능:** 일반/랭크/AI·친구/XP/꾸미기 회귀, 오목 기존 자유룰 대국 보존과 새 대국 흑 33/44/장목 금수
- [ ] 모바일 320/390, 태블릿 768, 데스크톱 1280/1920, 브라우저 실제 200% 확대, 버튼/패널/게임판 잘림·가로/미세 세로스크롤·접근성 확인

## 4. 브랜치·릴리스 단계

1. [ ] `develop`에 실제 포함된 기능만으로 `release/v0.4.2` 생성. `package.json`/lockfile 버전 정합성·CHANGELOG·문서 인수 작성
2. [ ] Quality (lint/typecheck/Vitest/Next build), PostgreSQL 17 통합·백업/복원·Supabase Auth/Realtime·release-source-guard 및 관련 Chromium QA를 **해당 RC 최신 SHA**에서 확인
3. [ ] 무료 Vercel Preview 횟수를 최소화하고, 사용자가 승인한 Preview 환경/DB 연결·쓰기 범위에서 실제 A/B E2E 진행. Production 비밀을 전체 Preview에 확장하지 않기
4. [ ] 결과와 실패 재현을 #345/상세 기능 이슈에 기록. 실패 시 RC 브랜치 보완·CI/Preview 재검증
5. [ ] **사용자 별도 Production 승인 후만** `release/v0.4.2 → main` PR 검토·병합, Production READY·실제 배포 SHA/alias/HTTP/API·런타임 오류 Smoke 확인
6. [ ] 실제 사용 E2E와 공식 Git 태그/GitHub Release 발행 여부를 각각 기록, `develop` 변경 역반영·불필요한 Preview 키/플래그 정리

## 5. 인수 사실과 금지

2026-11-11 기준 [PR #342](https://github.com/SuperNova080710/Alkkagi/pull/342), [#343](https://github.com/SuperNova080710/Alkkagi/pull/343)은 `develop`에만 병합돼 있으며, [#344](https://github.com/SuperNova080710/Alkkagi/pull/344)는 아직 미병합입니다. **v0.4.2는 Production 배포 전입니다.** 이 문서 작성은 GitHub 문서 브랜치에서만 이루어지며 DB/Preview/Production에 아무런 쓰기 작업도 수행하지 않았습니다.
