# P3 최종 인수 및 검증 기록 — Alkkagi Arena (2026-10-29)

## 검증 경계
- **2차 제출 기준:** `feb483e51ed706ee144a4067608c7ecccde09e66`, [P2 제출 문서](p2-submission-2026-10-28.md). 해당 기록은 변경하지 않음.
- **P3 최종 기능 기준:** `dced77300cc69a5e3344246f69ec5b800c2c2a57` (PR #45 main 병합).
- **자동 검증:** [GitHub Actions #40797946845](https://github.com/SuperNova080710/Alkkagi/actions/runs/40797946845) `success` — lint, 타입검사, Vitest/PGlite, Next.js build.
- **배포:** Vercel Production 위 기능 커밋 `READY`, https://alkkagi-alpha.vercel.app
- **사용자 실사용:** 동료와 랭크 플레이 점수/리더보드 정상 보고, 내 알·턴 시인성 개선 수용, 채팅 포커스·경기 결과 애니메이션 최신 수정 정상 보고. 이는 전문 사용성 실험의 측정값은 아님.

## 2차 이후 주요 변경 (GitHub 근거)

| PR | 기능 | 확인 |
| --- | --- | --- |
| [#36](https://github.com/SuperNova080710/Alkkagi/pull/36) | 주황/파랑 진영·현재 턴·선공/후공·내 알 표시 | UI 테스트/운영 배포 |
| [#38](https://github.com/SuperNova080710/Alkkagi/pull/38) | 닉네임 변경/중복 확인, 인덱스/RPC, 로비·리더보드 연동 | PGlite 형식·대소문자·권한/전적 보존, 운영 migration 010 |
| [#39](https://github.com/SuperNova080710/Alkkagi/pull/39) | 게임판 색상 배지 제거·내 알의 이중 테두리 간소화 | 회귀 테스트/사용자 디자인 수용 |
| [#41](https://github.com/SuperNova080710/Alkkagi/pull/41) | 경기별 채팅·중앙 결과창·RP 증감·로비/재도전 | PGlite 참가자 RLS/전송 제한, 결과 SSR 테스트, 운영 채팅 migration |
| [#43](https://github.com/SuperNova080710/Alkkagi/pull/43) | Enter 전송, Shift+Enter 줄바꿈, 한글 IME 보호 | 키보드 단위 검사/배포 |
| [#45](https://github.com/SuperNova080710/Alkkagi/pull/45) | 채팅 포커스 유지, 결과 페이드/상승, reduced-motion | CSS·SSR 회귀 검사/배포/최종 사용자 정상 보고 |

## 운영 DB 집계 (2026-10-29 직접 조회)

| 항목 | 값 |
| --- | ---: |
| 완료 일반전 | 10건 |
| 완료 랭크전 | 11건 |
| `rating_history` | 22건 / 11경기 |
| 정산 RP 변화 합계 | 0 |
| `match_messages` | 13건 / 3경기 |

**해석 주의:** 개발/테스트 중 생성된 기록을 포함할 수 있으며 실제 개별 유료 사용자 수·일별 서비스 이용률이 아닙니다. 개인 프로필·이메일·메시지 본문은 증빙에 노출하지 않았습니다.

## 기술·접근권한 확인
- 서버가 알 소유권·턴·충돌 및 승패를 판정합니다. Elo RP는 경기당 한 번의 DB 트랜잭션으로 정산됩니다.
- 닉네임은 대소문자 무관 고유 인덱스와 본인만 접근할 수 있는 서버 RPC로 처리합니다.
- 채팅은 해당 경기 참가자의 SELECT RLS와 인증 사용자 전용 전송 RPC, 전송 길이·간격 제한을 적용합니다.
- 결과 화면은 클라이언트가 RP를 재계산하지 않고 해당 경기 `rating_history`의 실제 정산 레코드를 조회합니다.

## 최종 제출 재현 — 3단계
1. https://alkkagi-alpha.vercel.app 로그인 후 두 계정의 닉네임 설정·중복 확인.
2. 초대방/랭크 매칭에서 본인 알·턴 표시와 게임판, 좌측 채팅(Enter/Shift+Enter/연속 입력)을 확인.
3. 경기 종료 후 승패/±RP/정산 전후, 재도전·로비 이동, 랭크 리더보드를 확인.

## 미확인/향후 운영 이슈
- **ALEPH 최종 제출 사이트 접수/승인**: 별도 사용자 확인이 필요함.
- Supabase Advisor WARN: **Auth 유출 비밀번호 보호 설정**, **SECURITY DEFINER 함수 추가 권한 감사**.
- 다중 탭/대규모 동시 접속, 악의적 대량 요청에 대한 전문 부하/보안 감사 **미실시**.
- 후속 게임 밸런스/모바일 접근성/채팅 관리 기능은 별도 운영 개선. 관련 [#16](https://github.com/SuperNova080710/Alkkagi/issues/16).

별첨: 발표 `Alkkagi_Arena_P3_Final_Presentation.pptx` 9장, 증빙 `Alkkagi_Arena_P3_Verification_Evidence.pdf` 2쪽 (대화에서 제공, GitHub 원본 이진 파일 업로드를 주장하지 않음).
