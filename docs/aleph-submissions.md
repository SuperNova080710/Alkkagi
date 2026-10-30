# ALEPH 앱 프로젝트 제출 문서

## P3 — 최종 제출 (2026-10-29 현재)
- [최종 제출 양식 5개 항목 및 필수 URL](p3-final-submission-2026-10-29.md)
- [최종 인수·검증 근거 및 P2 이후 PR](p3-final-acceptance-2026-10-29.md)
- [현재 계획서 v10](../plan.md) (당시 P3 기준점은 제출 자료에 보존)
- [닉네임 설정](p3-nicknames.md), [보드 시인성 개선](p3-visual-identity-tuning.md), [채팅·결과](p3-chat-results.md), [채팅 포커스·결과 모션](p3-chat-focus-result-motion.md)

**발표 PPTX는 제출 화면에 반드시 별도 첨부해야 합니다.** 검증 증빙 PDF는 선택 첨부입니다. 파일 생성/다운로드와 ALEPH 플랫폼 접수는 별개이며, **아직 최종 제출 접수 완료라고 주장하지 않습니다.**

## 보존하는 P2 기준점
- [중간 점검 2차 입력 문구](p2-submission-2026-10-28.md)
- [2026-10-28 인수/DB 증빙](acceptance-2026-10-28.md)
- [기본 랭크 매칭과 정산](p2-ranked.md)

P2 문서는 수정하지 않고 P3 이후의 기능·검증을 새 파일로 기록합니다.

결과물: https://alkkagi-alpha.vercel.app

저장소: https://github.com/SuperNova080710/Alkkagi

## P3 제출 이후 서비스 개발 현황

- **[2026-10-30 최신 개발·운영 인수](current-status-2026-10-30.md)** · [이전 10/29 스냅샷](current-status-2026-10-29.md)
- [게임형 UI 설계](ui-redesign-v1.md) · [구현 QA](design-implementation.md) · [플레이어 UI](player-directory-ui.md)
- [친구 API](friends-api-v1.md) · [DM API](direct-messages-api-v1.md) · [보안 점검](security-review-2026-10-29.md)
- 친구방 초대 계약: [main 문서](room-friend-invites-api-v1.md) (PR #90 병합, SQL 007 운영 적용 미확인)
- 친구 UI 설계: [main 문서](friends-ui.md) (PR #96 병합, `FRIENDS_UI_ENABLED` 기본 OFF)

이 섹션은 과거 ALEPH P1/P2/P3 제출 문구를 소급 변경하지 않습니다. 코드 병합, DB 적용, 배포 READY, 실제 두 계정 검증은 별개의 사실입니다.

## 신규 작업 및 공개 검색 대비 (2026-10-30)

- [데스크톱 밀도 QA 기록](ui-density-2026-10-29.md) · [와이드 히어로 QA 기록](ui-hero-wide-review-2026-10-29.md) · 반응형 타이포 PR #125
- [XP/레벨 병합 PR #110](https://github.com/SuperNova080710/Alkkagi/pull/110) · [XP API 계약](experience-api-v1.md)
- [코스메틱 병합 PR #115](https://github.com/SuperNova080710/Alkkagi/pull/115) · [API 계약](cosmetics-api-v1.md)
- [SEO 병합 PR #131](https://github.com/SuperNova080710/Alkkagi/pull/131) · [검색 콘솔 인계](google-search-seo.md) · [공개 규칙 가이드 병합 PR #137](https://github.com/SuperNova080710/Alkkagi/pull/137)

아직 병합하지 않은 문서는 **main에 있다고 가정하지 마세요.** 검색 색인·사이트맵 제출·Google 상위 노출도 완료되지 않았습니다.

## 2026-10-30 메신저 UI·릴리스 운영 추가

- [메신저 UI #143 인수](direct-messages-ui-v1.md): `FRIENDS_UI_ENABLED`/`MESSAGES_UI_ENABLED` 기본 OFF, SQL 004~006과 A/B E2E 선행
- [버전 브랜치·수동 Preview 매뉴얼](release-process.md): #148 병합, develop → release/vX.Y.Z → main
- [미출시 변경 기록](../CHANGELOG.md): 실제 태그·Production 확인 전 공식 릴리스로 표시하지 않음
- [XP 프로필 UI 후속 #149](https://github.com/SuperNova080710/Alkkagi/issues/149) (하위 #150/#151): 아직 UI 구현 진행 중이며 운영 SQL 008도 미확인

P2/P3 시점 제출·증빙 원본은 변경하지 않습니다.

## 2026-10-30 추가 개발·운영 인수

- [XP 프로필 UI PR #159](https://github.com/SuperNova080710/Alkkagi/pull/159): `develop` 검토 중. [UI 인수 문서(PR 브랜치)](https://github.com/SuperNova080710/Alkkagi/blob/feat/ui-experience-levels-v1/docs/experience-ui-v1.md), 운영 SQL 008 미적용·기능 플래그 기본 OFF
- [코스메틱 UI #162](https://github.com/SuperNova080710/Alkkagi/issues/162): 하위 #163~#165, 실제 인벤토리/에셋/게임판 외형 화면 진행 중, 운영 SQL 009 미적용
- [PG17 사전점검 Draft PR #161](https://github.com/SuperNova080710/Alkkagi/pull/161): 운영 PostgreSQL 17.11 SELECT-only 68항목 검사(기초 7 ready, 004 inspect 1, 005~009 pending 60), [STOP/운영 인수 문서(PR 브랜치)](https://github.com/SuperNova080710/Alkkagi/blob/feat/ops-db-preflight/docs/db-rollout-preflight.md)
- GitHub 코드의 main/develop 병합은 운영 마이그레이션·첫 Release Candidate·실사용/Google Search Console 인수를 대신하지 않습니다.
