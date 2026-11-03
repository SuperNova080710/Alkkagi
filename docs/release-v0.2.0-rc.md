# Alkkagi Arena · v0.2.0 릴리스 후보 인수

작성: 2026-11-02 · 관리: [#203](https://github.com/SuperNova080710/Alkkagi/issues/203) · [#204](https://github.com/SuperNova080710/Alkkagi/issues/204) · [#205](https://github.com/SuperNova080710/Alkkagi/issues/205) · [#206](https://github.com/SuperNova080710/Alkkagi/issues/206)

**상태: 출시 후보 준비 중. 이 문서 및 브랜치 생성은 배포 승인이 아닙니다.**

## 릴리스 원본과 경계

| 구분 | 값 |
| --- | --- |
| Release 브랜치 | `release/v0.2.0` |
| 분기 원본 develop SHA | `b00bbcf7519ab826e860d2f3222de4d07a9bf6cd` |
| 현재 운영 main SHA (분기 시점) | `cd752f6bd335a518302595e2187b54717c9ddaea` |
| Production | 기존 v0.1.0 코드 유지, v0.2.0 미출시 |
| 소스 버전 | `package.json`, `package-lock.json` 모두 `0.2.0` |
| 운영 PostgreSQL | 17.11 · SQL 004~009 2026-11-02 적용 완료(재실행 금지) |
| 운영 실사용 A/B·UI 200% | **NOT RUN** · 배포 이후 별도 진행 |
| 릴리스 태그 / GitHub Release | **미발행** |
| QA 페이지 | `/qa/two-account`, 기본 OFF·서버 활성화 플래그 및 고정 A/B allowlist 필요 |

포함 코드에는 친구·DM·초대·XP·꾸미기 및 브라우저 QA, 최신 통합 CI가 있습니다. **코드 병합 ≠ 운영 기능 플래그 ON ≠ 실제 사용자 검증 완료**입니다. 구체 변경은 [CHANGELOG](../CHANGELOG.md), 운영 DB 상태는 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155)와 [#196](https://github.com/SuperNova080710/Alkkagi/issues/196)를 봅니다.

## 단계 1 — GitHub CI, 배포 없이 진행

- [ ] 정확한 RC 소스·package/lock 버전이 동일한지 확인하고 본 문서에 SHA 기록
- [ ] `release/v0.2.0 → main` Draft PR 생성. 동일 저장소에서만 PR 허용; `main` merge 금지
- [ ] GitHub Ruleset `No-main-push` active / 최신 브랜치 강제 / Actions 소스 Required 5개 재확인
- [ ] 실제 RC PR에서 아래 job **전부** `success`. `skipped`·`pending`·상충하는 SHA는 통과 아님
  - `release-source-guard`
  - `check` (lint, TS, Vitest, Next build)
  - `pg17-disposable-integration`
  - `local-supabase`
  - `disposable-pg17-restore`
- [ ] Workflow 변경(.github/workflows/**)의 검증·승인 통제 재확인. PR 코드로 workflow를 변조하면 release guard만으로 절대 보호되지 않음
- [ ] 기존 `develop` Quality 성공: [#41396196721](https://github.com/SuperNova080710/Alkkagi/actions/runs/41396196721); 릴리스 PR의 실제 CI와 혼동하지 않기

## 단계 2 — 별도 사용자 승인 후 *배포된 웹*에서 E2E

사용자에게 로컬 Alkkagi 저장소/.env 파일이 없으므로 브라우저 테스트는 **배포 뒤** 진행합니다.

- [ ] Vercel Free 한도 및 자동 배포 제한 실제 상태 점검. Preview가 Git push로 자동 생성됐다고 가정하지 않음. 수동 Preview는 가능하면 1회만 승인 후 생성
- [ ] Preview의 Supabase 대상이 별도 테스트 DB인지 운영 DB인지 확인. 운영 DB 연결 시 Preview라도 **실운영 쓰기**이며 테스트 범위/동의가 필요
- [ ] 승인된 환경에서만 서버 전용 `OPS_TWO_ACCOUNT_QA_ENABLED=true`, `OPS_TWO_ACCOUNT_QA_USER_IDS`의 정확한 **서로 다른 A/B UUID 2개** 설정. ID/토큰/키를 GitHub·PR에 기록하지 않음
- [ ] 별도 브라우저 세션 A/B로 로그인. **Auth + 본인 프로필 + 비공개 데이터 RLS** 검증; 양쪽 XP baseline 확정
- [ ] **친구 요청/수락 → B Realtime INSERT 구독 확인 → A DM 1건 → WebSocket 수신 ID = REST ID**, 실패 시 반복 발송 금지
- [ ] 새 일반전 대기방 1개 → A의 친구 초대 1회 → B seat2 수락 → 실제 브라우저 게임 1판 완료 → 두 계정 XP 원장 1행씩·증분 대조. 일일 보상 상한이면 LIMITED, XP 지급 PASS 아님
- [ ] 두 계정 기본 알 보유·장착, PC/모바일/실제 200% Zoom 화면, 불필요한 스크롤, 게임판 포인터·턴·결과 UI 확인
- [ ] 비밀번호·JWT·사용자 UUID·DM 본문 공개 없이 PASS/FAIL, 브라우저/폭·콘솔·비식별 집계만 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155), [#196](https://github.com/SuperNova080710/Alkkagi/issues/196), [#194](https://github.com/SuperNova080710/Alkkagi/issues/194)에 인수
- [ ] 실운영 QA 완료 후 QA 활성화 플래그 OFF / 별도 재배포 필요 여부 확인

## 단계 3 — Production 출시 (사용자 재승인 필수)

- [ ] CI 5종 PASS, E2E 실제 PASS, 운영 RLS·재해복구 수용 및 브라우저 UX 확인
- [ ] 기능 플래그의 실제 출시 ON/OFF 범위 확정: `FRIENDS_UI_ENABLED`, `MESSAGES_UI_ENABLED`, `ROOM_INVITES_UI_ENABLED`, `EXPERIENCE_UI_ENABLED`, `COSMETICS_UI_ENABLED`
- [ ] 사용자 승인 후 `main` PR 병합 → Vercel Production READY → 실제 HTTP/로그인/일반전/랭크/AI/Realtime Smoke
- [ ] 성공한 **실제 main 커밋**에 `v0.2.0` 태그/GitHub Release 발행 및 CHANGELOG 배포 날짜 확정
- [ ] RC 수정 사항 `develop` 역반영, CI 확인, 사용 종료 브랜치/QA 플래그 정리

## 즉시 STOP 조건

Required CI 실패/스킵, 운영 DB RLS 차단/보안 위험, 관리자 키의 브라우저 노출, 배포 한도 초과, Preview-Production DB 혼동, QA 비승인 쓰기, SQL 재실행, 미검증 JWT/Realtime, 새 버전 Smoke 실패. 장애 시 **Vercel 이전 Production Deployment로 코드 롤백**을 검토하지만 DB 스키마·데이터는 자동 복구되지 않습니다. 기존 SQL 004~009를 재적용하거나 임의 데이터를 삭제하지 않습니다.

## 인수 기록

| 증빙 | 상태 |
| --- | --- |
| RC 원본 SHA | `b00bbcf7519ab826e860d2f3222de4d07a9bf6cd` |
| 릴리스 메타데이터/문서 커밋 | 이 문서를 포함한 RC 브랜치의 커밋 로그 참조 |
| RC Draft PR | 아직 미생성 |
| GitHub Required CI 5종 | RC PR 생성 후 검증 |
| Vercel QA 배포 URL | 미생성 |
| 운영 A/B E2E | NOT RUN |
| 사용자 Production 승인 | 미승인 |
