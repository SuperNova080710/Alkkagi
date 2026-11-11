# v0.4.2 릴리스 후보 인수 체크리스트 — 2026-11-11

> **상위 이슈:** [#345](https://github.com/SuperNova080710/Alkkagi/issues/345) · **후속 체스 기능:** [#327](https://github.com/SuperNova080710/Alkkagi/issues/327).
> 현행 **Production은 v0.4.1**(`main` `d40e1101`). `release/v0.4.2`는 통합 코드 검증을 위한 RC이며 운영 배포가 아닙니다.
> GitHub PR 병합·CI 성공·Preview READY·실계정 E2E·운영 DB 적용·Production 배포는 별개 인수 항목입니다.

## 1. 릴리스 범위 — 확정 후보

| 기능 | 개발 PR | develop 병합 | 사용자 확인 기준 |
| --- | --- | --- | --- |
| 오목 랭크전 DB 채팅 SELECT/RPC 거부 | [#342](https://github.com/SuperNova080710/Alkkagi/pull/342) | `5d76e3d2` | 랭크 메시지 접근 불가, 일반전 채팅 유지, 기존 기록 보존 |
| 공개 AI 안내·SEO 제목 | [#343](https://github.com/SuperNova080710/Alkkagi/pull/343) | `1fc3bf43` | 로그인 없이 공개 안내, title 중복 없음 |
| 체스 일반전 양측 수락 재대결 | [#344](https://github.com/SuperNova080710/Alkkagi/pull/344) | `f1a33f7b` | 1/2→2/2 투표, 양측 동일한 새 경기, 색 반전 |
| 체스 일반·랭크 온라인 XP | [#349](https://github.com/SuperNova080710/Alkkagi/pull/349) | `2b7f94de` | 최초 종료에만 XP·상한 및 RP 독립 |
| 체스 일반전 참가자 채팅 | [#350](https://github.com/SuperNova080710/Alkkagi/pull/350) | `34475a37` | 참가자만 조회/전송, Realtime·재접속, 랭크 거부 |
| 오목돌·체스 기물 꾸미기 | [#354](https://github.com/SuperNova080710/Alkkagi/pull/354) | `073058cb` | 기존 장착 보존, 신규 슬롯, 비공개·고대비·기본 외형 |
| 문서·이슈 정리 | [#351](https://github.com/SuperNova080710/Alkkagi/pull/351) | `9f005cad` | 실제 출시와 개발 상태 구분 |

**릴리스 범위 6개 기능 PR + 1개 문서 PR, 신규 SQL 5개**. 각 개발 PR의 개별 CI는 성공했으나 통합 RC 최신 HEAD의 재검증은 별개입니다.

## 2. 신규 SQL 정확한 적용 순서

**운영 적용 전용 승인 없이 실행 금지.** 먼저 운영 PostgreSQL 17.11의 기존 스키마·migration 이력, 권한·RLS·Realtime publication을 *읽기 전용*으로 점검합니다. 아래 SQL이 이미 적용됐는지 확인하고 **미적용 파일만** 순서대로 각 1회 적용합니다. 과거 알까기 004~009, 오목 001~006 및 v0.4.0 신규 SQL은 재실행하지 않습니다.

| 적용 순서 | 신규 마이그레이션 | 검증 항목 |
| --- | --- | --- |
| 1 | `20261111025029_omok_ranked_chat_boundary.sql` | 기존 랭크 메시지 보존·RLS SELECT 차단·RPC 전송 거부·일반전 Realtime 유지 |
| 2 | `20261111025703_chess_casual_rematch.sql` | 트랜잭션 행 잠금, 동시 투표 멱등성·원본 결과 보존·INSERT/UPDATE Realtime |
| 3 | `20261111033733_chess_online_xp.sql` | 3게임 공동 일일/상대 상한·중복 지급·종전 종료 소급 없음·RP와 분리 |
| 4 | `20261111033735_chess_casual_chat.sql` | 일반전 참가자 조회/전송·RLS·요청 재시도·1초/280자/30분 제한·Realtime |
| 5 | `20261111050715_omok_chess_cosmetics.sql` | 기존 장착 보존, 신규 코드·슬롯 제약·해금/소유 검증·비공개 대체 |

- [ ] 실제 운영 이력과 **현행 v0.4.1 Production DB**의 객체·권한 차이를 기록합니다.
- [ ] RC 최신 SHA 기준 **일회용 PG17 전체 migration**을 위 순서대로 재생합니다. 기능별 스위트뿐 아니라 순차 적용 시 중복 함수·정의 교체 호환성을 확인합니다.
- [ ] 운영 전에 복원 경로와 변경 후 구버전 서비스 코드 호환성 및 손상/중복 발생 시 대응 방안을 기록합니다.
- [ ] 통합 Supabase Auth JWT·PostgREST·Realtime INSERT/UPDATE, XP·cosmetics 공개 프로필 권한을 일회용 환경에서 검증합니다.
- [ ] 사용자 승인 전 운영 SQL/키/기능 플래그를 수정하지 않습니다. 서비스 테스트 데이터도 삭제하거나 초기화하지 않습니다.

## 3. RC 품질 게이트

- [ ] `package.json`과 `package-lock.json` 루트 버전이 둘 다 `0.4.2`이며 CHANGELOG 릴리스 후보 기록과 일치합니다.
- [ ] RC 최신 SHA의 `npm run check`(lint, 타입, Vitest, 빌드) 성공.
- [ ] PostgreSQL 17 모든 관련 SQL/RLS·서로 다른 두 연결의 재대결 경합·공통 XP 상한·기존 오목 금수 CI 성공.
- [ ] 로컬 Supabase Auth/Realtime 통합 및 백업·복원 CI 성공. **skipped는 성공으로 처리하지 않습니다.**
- [ ] Chromium 모바일 320/390, 768, 1280/1920, 모션 감소·고대비·브라우저 200% 확대, 체스·오목 기존 보드/결과/입력 회귀 확인.
- [ ] 공동 수정 영역 `src/components/chess/chess-online.tsx`, `src/components/chess/client.ts`의 재대결+채팅+꾸미기 동시 렌더·종료 흐름 확인.
- [ ] 해당 RC SHA의 빌드와 Preview DB 연결을 검증하고 Production 비밀키 노출/키 범위 확장 없음 확인.

## 4. Preview 실제 두 계정 수용

- [ ] **오목 채팅:** A/B 일반전 메시지/Realtime·재접속 정상, 랭크전 참여자도 GET/POST/DB 직접 SELECT·RPC INSERT 거부.
- [ ] **공개 가이드:** 비인증 `/how-to-play` 성공, 알까기·오목·체스 AI 안내 및 title/robots/canonical/모바일 확인.
- [ ] **체스 재대결:** 경기 확정 종료 → A 수락 1/2 → B 수락 → 두 화면이 같은 다음 경기로 전환, 색 반전·기보 보존·재접속·만료·중복 POST 검증.
- [ ] **체스 XP:** 일반/랭크 승·패·무 보상, 3게임 공통 상한·동일 상대 제한, 기권·턴 초과·중복/재시도·RP 독립 검증.
- [ ] **체스 채팅:** 참가자만 양방향 Realtime 및 재접속 기록, 랭크·비참가자 거부, 재대결 새 경기에서는 이전 기록 미승계.
- [ ] **꾸미기:** 레벨 2 해금·장착·기본값, 오목·체스 일반/랭크/AI에서 자기 외형, 일반전 공개 상대와 비공개 상대 폴백, 고대비/모바일.
- [ ] **회귀:** 알까기 일반·랭크·AI·친구·XP, 오목 33/44·장목 금수, 체스 체크메이트·기권·90초·AI·랭크 결과.
- [ ] 실계정 QA의 계정 식별자/토큰·메시지 본문은 Issue/PR/로그에 남기지 않습니다.

## 5. Production 승격 게이트

1. [ ] 이번 RC의 정확한 commit SHA와 CI/Preview 테스트 증거를 #345에 기록.
2. [ ] 사용자 별도 **운영 SQL 변경 승인** 및 Production 배포 승인을 확인.
3. [ ] 기존 SQL은 재실행하지 않고 승인받은 미적용 SQL만 2절 순서로 반영, DDL/RLS/Realtime 검증.
4. [ ] `release/v0.4.2` → `main` PR 검토·병합 후 Vercel Production READY/배포 SHA·alias·Runtime 오류/핵심 게임 Smoke 확인.
5. [ ] `develop` 릴리스 문서·코드 역반영, 공식 Git tag/Release 발행 여부 기록.

**이 문서와 릴리스 후보 브랜치 생성은 운영 DB/Preview/Production 배포 완료를 의미하지 않습니다.**
