# Alkkagi Arena — ALEPH 프로젝트 계획 v2

> 갱신일: 2026-10-28. 상태: P1 제출 완료, P2 구현·DB/CI/Production 반영, P3 복구·품질 기능 개발 중.
> 이 문서는 작업 시작용 GitHub 버전입니다. ALEPH 제출용 상세 계획서 원본과 함께 관리하고, 변경 시 사유와 버전을 기록합니다.

## 프로젝트 목표
- **한 줄 소개:** 친구와 방을 만들어 1:1 알까기를 즐기거나 랜덤 랭크 매칭에 참여하여 RP와 순위를 경쟁하는 웹게임.
- **대상:** 설치 없이 브라우저에서 친구와 경쟁하려는 사용자.
- **핵심 기능 3가지:** (1) 서버 판정 기반 1:1 알까기 (2) 초대 코드 방 대전 및 랜덤 매칭 (3) RP/리더보드/전적.
- **완료 기준:** Vercel 공개 URL에서 서로 다른 두 기기로 일반전·랭크전을 완료하고, DB 확정 결과와 승패·RP·순위가 일치하는 것.

## 규칙 초안
- 두 사용자에게 알 5개씩 배치합니다.
- 턴 플레이어가 자신의 알을 골라 드래그로 방향·세기를 정합니다.
- 서버가 샷 입력 범위·소유권·턴을 검증하고 충돌/마찰/이탈을 계산합니다.
- 움직임이 멈춘 후 다음 턴으로 넘어갑니다. 상대 알 전부 제거 시 승리.
- 양측 동시 제거, 시간 초과, 포기 등은 구현 전 명확한 판정 규칙을 확정합니다.
- 현재 서버 물리의 세기 제한은 8~125로 조정했습니다. P3에서 신규 경기부터 턴 120초 제한을 추가하고 있습니다. 실제 플레이 밸런스는 추가 검증 대상입니다.

## 아키텍처
- UI: Next.js App Router, React, TypeScript, Tailwind CSS
- 판정: Vercel의 서버 API/Route Handler, 서버 전용 물리 시뮬레이션 (직접 구현한 결정적 물리 엔진)
- 인증: Supabase Auth
- 영속 상태: Supabase PostgreSQL
- 동기화: Supabase Realtime 비공개 채널. 이벤트는 알림이며 진실의 원천은 DB 확정 스냅샷.
- 배포: Vercel. 서버 메모리에 장기 보관되는 경기 상태에 의존하지 않습니다.

### 서버 권한과 무결성
1. 샷 요청에는 matchId, turnNo, requestId, pieceId, 방향 및 세기를 전달합니다.
2. 서버에서 인증, 현재 턴, 알 소유권, 샷 세기, 중복 요청을 검사합니다.
3. 턴 번호/보드 스냅샷을 잠금 후 재검증해 원자적으로 결과를 확정합니다.
4. DB에 최종 보드/현재 턴/승패를 저장하고 이벤트를 전송합니다.
5. 랭크전 결과와 RP 변경은 한 트랜잭션에서 경기당 1회만 정산합니다.
6. 서버 전용 비밀키는 클라이언트에 노출하지 않으며 RLS 정책을 확인합니다.

## 데이터 모델 초안
- profiles(id, nickname, rating, ranked_wins, ranked_losses)
- rooms(id, code, owner_id, mode, status, expires_at)
- room_players(room_id, user_id, seat)
- matches(id, mode, player1_id, player2_id, status, turn_user_id, turn_no, board_state, winner_id)
- shots(id, match_id, turn_no, player_id, piece_id, input, result_state)
- ranked_queue(user_id, rating_snapshot, joined_at, heartbeat_at)
- rating_history(match_id, user_id, before_rating, after_rating, delta)
- rematch_votes(match_id, user_id)
- shot_rate_limits(user_id, last_attempt) — P3 검증 중

중복 샷 및 랭크 정산을 방지하는 유니크 제약을 포함합니다. 점수/승패/보드 상태는 클라이언트에서 직접 수정하지 못하도록 설계합니다.

## 단계별 이슈와 완료 조건
### P1 — #1
세부 이슈 #4 ~ #10. 로그인, 코드방, 물리 판정, 턴 동기화와 공개 URL의 1회 정상 일반전 종료.
### P2 — #2
세부 이슈 #11 ~ #13. 원자적 랜덤 매칭, Elo RP (초기 1,000/K=32), 전적 및 리더보드 구현·자동 검사·DB/Production 반영 완료. 실제 두 계정 E2E·2차 제출은 미완료.
### P3 — #3
세부 이슈 #14 ~ #16. 재접속 링크·서버 턴 만료·레이트 제한·키보드 보조 조작을 PR #32에서 개발 중. 운영 마이그레이션/모바일 실측/최종 제출은 미완료.

## GitHub 작업 방식
- 큰 단계별 브랜치: feat/p1-core-match, feat/p2-ranked-matchmaking, feat/p3-recovery-hardening.
- 하위 이슈마다 맥락, 수정 범위, 완료 조건과 검증을 작성합니다.
- 구현 단위별로 명시적 메시지와 함께 커밋합니다.
- PR을 통해 테스트 및 변경 내용을 점검한 후 기본 브랜치로 병합합니다.

## 위험 및 테스트
- 물리 정확성: 서버 결과만 확정값, 브라우저는 애니메이션 출력.
- 동시성: DB 제약과 원자적 상태 전이, 턴 및 정산 멱등성.
- 재접속: 최신 스냅샷을 다시 읽어 동일 상태 복원.
- 평가: 두 계정 일반전, 중복 샷, 턴 도용 거절, 랜덤 매칭, 랭크 정산 1회, 교차 계정 권한, 두 기기 재현.
- **자동화 검사:** P1/P2 GitHub Actions에서 lint/typecheck/Vitest/Next build 통과. P2 PGlite의 원자적 매칭·Elo 정산·권한 검증 통과. P3 브랜치에서 재접속·타임아웃·레이트 제한과 조작 접근성 테스트 진행 중.
- **실제 E2E:** 두 계정/실기기에서의 최종 랭크 전적·모바일·120초 만료 검증은 여전히 남아 있습니다.

## 계획 변경 이력
| 버전 | 날짜 | 내용 |
|---|---|---|
| v1 | 2026-10-28 | 1:1 알까기 / 방 / 매칭 / 랭크 시스템으로 프로젝트 확정, 작업 브랜치 및 이슈 정리 |
| v2 | 2026-10-28 | P1 제출·P2 랭크/정산 구현·운영 배포 반영, P3 재접속/120초 제한/보안·접근성 개선 현황 명시. 단계별 실측 E2E는 미검증으로 분리 |

ALEPH는 반 추가 과제가 아닌 프리미엄 앱 프로젝트 P1→P2→P3만 진행합니다.
