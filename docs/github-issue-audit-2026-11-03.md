# GitHub 일반 이슈 전수 정합성 점검 — 2026-11-03

> **스냅샷:** 2026-11-03 KST, GitHub REST 전체 페이지 조회. PR 이슈 객체는 **일반 이슈 집계에서 제외**합니다. 작성 후에도 새 이슈·PR이 생길 수 있으므로 최신 GitHub 상태가 항상 우선입니다.

## 집계

| 항목 | 건수 |
| --- | ---: |
| 전체 일반 이슈 | 153 |
| 완료 일반 이슈 | 128 |
| OPEN 일반 이슈 | 25 |
| 이번 문서화 과정에서 완료 처리 | 48 |
| 전체 PR | 78 |
| OPEN PR | 4 |

이번 종료 항목은 **GitHub의 실제 병합된 PR과 CI·문서 산출물 범위**만 종결했습니다. 운영 A/B E2E나 Preview·Production 릴리스가 남은 관련 상위 인수 이슈는 OPEN으로 유지합니다.

## 현재 열린 일반 이슈

| 이슈 | 제목 | 상태 | 계속 열어 두는 이유 |
| --- | --- | --- | --- |
| [#3](https://github.com/SuperNova080710/Alkkagi/issues/3) | [P3] 재접속·품질·보안·최종 배포 검증 | OPEN | ALEPH P3 실제 접수·승인 확인 |
| [#16](https://github.com/SuperNova080710/Alkkagi/issues/16) | [P3] 보안·성능·최종 배포·문서 | OPEN | P3 보안·운영 최종 검증 |
| [#62](https://github.com/SuperNova080710/Alkkagi/issues/62) | [Security S1] 운영 Supabase Advisor 권한 감사와 RPC 악용 방지 | OPEN | RPC 심층 보안 감사/운영 악용 시험 |
| [#64](https://github.com/SuperNova080710/Alkkagi/issues/64) | [Security S1.2] Supabase Advisor 경고 23건 권한·위험 분류 문서화 | OPEN | Advisor 및 RPC 19개 소스 심층 점검 |
| [#65](https://github.com/SuperNova080710/Alkkagi/issues/65) | [Security S1.3] Supabase Auth 유출 비밀번호 보호 설정 결정 | OPEN | Supabase Auth Free 요금제/관리자 설정 결정 |
| [#126](https://github.com/SuperNova080710/Alkkagi/issues/126) | [SEO S1] Google 검색 색인 준비·canonical·사이트맵·검색 콘솔 인계 | OPEN | Google Search Console 인증·색인 |
| [#144](https://github.com/SuperNova080710/Alkkagi/issues/144) | [Release R1] 버전 기반 브랜치 전략 및 수동 Preview 릴리스 체계 전환 | OPEN | 브랜치·수동 Preview 운영 실증 |
| [#188](https://github.com/SuperNova080710/Alkkagi/issues/188) | [CI R6] 릴리스 후보 전체 통합 CI 게이트 — PG17·Supabase E2E·백업 복원 | OPEN | main 필수 릴리스 CI·관리자 정책 검증 |
| [#192](https://github.com/SuperNova080710/Alkkagi/issues/192) | [CI R6.1] main 비릴리스 PR 우회 방지 — 항상 실행되는 release-source-guard | OPEN | release-source-guard Required Check 우회 방지 |
| [#194](https://github.com/SuperNova080710/Alkkagi/issues/194) | [UI QA] 전체화면→친구 초대→메신저→XP→코스메틱 순차 검증 및 통합 인수 | OPEN | 로그인 브라우저/UI·200% 확대 실측 |
| [#196](https://github.com/SuperNova080710/Alkkagi/issues/196) | [Ops R7] 운영 브라우저 A/B 인증·Realtime·일반전 XP E2E 인수 | OPEN | 운영 두 계정 Auth·WebSocket·XP E2E |
| [#203](https://github.com/SuperNova080710/Alkkagi/issues/203) | [Release v0.2.0] RC 동결·필수 CI·배포 후 브라우저 E2E·Production 승격 | OPEN | v0.2.0 CI·A/B 검증·Production 승격 |
| [#206](https://github.com/SuperNova080710/Alkkagi/issues/206) | [Release v0.2.0 / 3] 배포 후 A/B 실사용·UI 인수·승인된 Production 릴리스 | OPEN | 승인형 QA·Smoke·실제 태그 발행 |
| [#211](https://github.com/SuperNova080710/Alkkagi/issues/211) | [Ops v0.2.0] Preview AI 발사·기권 500 — 서버 Supabase 인증키 범위 분리 | OPEN | Preview AI 관리자키 범위 및 샷 500 |
| [#216](https://github.com/SuperNova080710/Alkkagi/issues/216) | [Docs 11/03] 전체 이슈·PR·브랜치 상태 정리 및 운영 문서 현행화 | OPEN | 본 문서 PR #228/#229 리뷰/병합 |
| [#217](https://github.com/SuperNova080710/Alkkagi/issues/217) | [v0.3.0 Epic] 알까기 + 오목 멀티게임 확장 및 릴리스 | OPEN | v0.3.0 오목 멀티게임 Epic/출시 승인 미완료 |
| [#218](https://github.com/SuperNova080710/Alkkagi/issues/218) | [v0.3.0 A] 멀티게임 아키텍처·릴리스 경계·라우팅 설계 | OPEN | 오목/알까기 분리 아키텍처 Draft PR #231 검토 |
| [#219](https://github.com/SuperNova080710/Alkkagi/issues/219) | [v0.3.0 B] 오목 15×15 자유룰 순수 엔진·테스트 | OPEN | 오목 15×15 순수 엔진 Draft PR #230 검토 |
| [#220](https://github.com/SuperNova080710/Alkkagi/issues/220) | [v0.3.0 C] 오목 Supabase 스키마·RPC·권한·경합 검증 | OPEN | 오목 전용 DB/RLS/RPC 구현·검증 예정 |
| [#221](https://github.com/SuperNova080710/Alkkagi/issues/221) | [v0.3.0 D] 오목 실시간 일반전·초대·채팅·재대결 | OPEN | 오목 2인 일반전·Realtime·복구 예정 |
| [#222](https://github.com/SuperNova080710/Alkkagi/issues/222) | [v0.3.0 E] 오목 AI 연습 대전 | OPEN | 오목 AI 3단계 구현/실사용 예정 |
| [#223](https://github.com/SuperNova080710/Alkkagi/issues/223) | [v0.3.0 F] 오목 독립 랭크 매칭·RP·리더보드 | OPEN | 오목 별도 RP·매칭·정산 구현 예정 |
| [#224](https://github.com/SuperNova080710/Alkkagi/issues/224) | [v0.3.0 G] 멀티게임 로비·UI QA·RC 및 Production 인수 | OPEN | 멀티게임 UI/브라우저 QA·v0.3.0 RC/Production 승인 예정 |
| [#225](https://github.com/SuperNova080710/Alkkagi/issues/225) | [Docs 216.1] develop 전체 최신 문서·운영/QA 인수 현행화 | OPEN | develop 문서 PR #228 리뷰/병합 |
| [#227](https://github.com/SuperNova080710/Alkkagi/issues/227) | [Docs 216.3] v0.2.0 RC 브랜치 인수 문서 상태 정정 | OPEN | RC 인수 문서 PR #229 리뷰/병합 |

**차기 범위:** #217~#224는 v0.3.0 오목 추가 로드맵으로, 단순히 브랜치가 생성됐다는 이유로 닫을 수 없습니다. #230/#231도 아직 Draft PR이며 실제 오목 서비스는 미배포입니다.

**관리/승인 경계:** #196·#203·#206·#211의 Preview 관리자 키·운영 데이터 쓰기·main/Production 병합은 사용자 별도 승인 필요. #188/#192의 Required Check 강제는 GitHub 관리자 설정 확인 전 PASS로 단정하지 않습니다. #3의 ALEPH 플랫폼 실제 접수도 확인되지 않았습니다.

## 종료된 일반 이슈 전체 목록

아래의 이번 작업 종료 항목은 각 이슈 맨 위에 **구현 완료 근거 PR 및 후속 운영/QA 이슈**를 남겼습니다. 기존 종료 이슈도 당시의 본문·증빙을 그대로 보존합니다.

| 이슈 | 제목 | 분류 |
| --- | --- | --- |
| [#1](https://github.com/SuperNova080710/Alkkagi/issues/1) | [P1] 두 사람이 끝까지 플레이할 수 있는 일반전 MVP | 기존 완료 |
| [#2](https://github.com/SuperNova080710/Alkkagi/issues/2) | [P2] 랜덤 랭크 매칭·RP 정산·리더보드 | 기존 완료 |
| [#4](https://github.com/SuperNova080710/Alkkagi/issues/4) | [P1] 프로젝트 스캐폴드 및 품질 검사 | 기존 완료 |
| [#5](https://github.com/SuperNova080710/Alkkagi/issues/5) | [P1] Supabase 인증·DB 스키마·RLS | 기존 완료 |
| [#6](https://github.com/SuperNova080710/Alkkagi/issues/6) | [P1] 코드방 생성·참가와 2인 입장 제어 | 기존 완료 |
| [#7](https://github.com/SuperNova080710/Alkkagi/issues/7) | [P1] 알까기 물리 엔진 및 게임 보드 | 기존 완료 |
| [#8](https://github.com/SuperNova080710/Alkkagi/issues/8) | [P1] 서버 샷 검증·턴 원자성·승패 판정 | 기존 완료 |
| [#9](https://github.com/SuperNova080710/Alkkagi/issues/9) | [P1] Realtime 경기 동기화 및 일반전 E2E | 기존 완료 |
| [#10](https://github.com/SuperNova080710/Alkkagi/issues/10) | [P1] Vercel P1 배포·문서·제출 증빙 | 기존 완료 |
| [#11](https://github.com/SuperNova080710/Alkkagi/issues/11) | [P2] 원자적 랜덤 매칭 큐 | 기존 완료 |
| [#12](https://github.com/SuperNova080710/Alkkagi/issues/12) | [P2] Elo RP 계산과 중복 없는 정산 | 기존 완료 |
| [#13](https://github.com/SuperNova080710/Alkkagi/issues/13) | [P2] 리더보드·전적·랭크전 E2E | 기존 완료 |
| [#14](https://github.com/SuperNova080710/Alkkagi/issues/14) | [P3] 이탈·재접속·타임아웃 복구 | 기존 완료 |
| [#15](https://github.com/SuperNova080710/Alkkagi/issues/15) | [P3] 모바일 조작·게임 UX·접근성 | 기존 완료 |
| [#21](https://github.com/SuperNova080710/Alkkagi/issues/21) | [P1 UI] 경기 화면 미세 스크롤 제거 및 반응형 드래그 좌표 교정 | 기존 완료 |
| [#23](https://github.com/SuperNova080710/Alkkagi/issues/23) | [UX] 일반전 재대전·턴 기록·모션·세기 밸런스 | 기존 완료 |
| [#24](https://github.com/SuperNova080710/Alkkagi/issues/24) | [UX] 양측 수락 재대전과 매치 이력 보존 | 기존 완료 |
| [#25](https://github.com/SuperNova080710/Alkkagi/issues/25) | [UX] 게임판 오른쪽 턴 로그·탈락 수 | 기존 완료 |
| [#26](https://github.com/SuperNova080710/Alkkagi/issues/26) | [UX] 서버 물리 궤적 재생 애니메이션 | 기존 완료 |
| [#27](https://github.com/SuperNova080710/Alkkagi/issues/27) | [UX] 발사 세기·초기 알 배치 밸런스 | 기존 완료 |
| [#29](https://github.com/SuperNova080710/Alkkagi/issues/29) | [UI] 턴 진행 시 게임판 위치·크기 움찔거림 제거 | 기존 완료 |
| [#35](https://github.com/SuperNova080710/Alkkagi/issues/35) | [P3 UX] 내 알·초기 진영과 현재 턴을 명확히 표시 | 기존 완료 |
| [#37](https://github.com/SuperNova080710/Alkkagi/issues/37) | [P3 UX] 사용자 닉네임 설정·중복 확인·리더보드/대전 표시 통합 | 기존 완료 |
| [#40](https://github.com/SuperNova080710/Alkkagi/issues/40) | [P3 Gameplay] 경기 채팅과 종료 결과·RP 증감·재도전 UX | 기존 완료 |
| [#42](https://github.com/SuperNova080710/Alkkagi/issues/42) | [P3 UX] 채팅 Enter 전송·Shift+Enter 줄바꿈·한글 조합 입력 보호 | 기존 완료 |
| [#44](https://github.com/SuperNova080710/Alkkagi/issues/44) | [P3 UX] 채팅 전송 후 입력 포커스 유지·경기 결과 진입 애니메이션 | 기존 완료 |
| [#47](https://github.com/SuperNova080710/Alkkagi/issues/47) | [P3 이후] 대기실에서 AI 상대 추가·3단계 난이도 1인 연습전 | 이번 작업 종료 |
| [#49](https://github.com/SuperNova080710/Alkkagi/issues/49) | [UX] 대전 로비 AI 대전 설명 패널 제거 | 기존 완료 |
| [#51](https://github.com/SuperNova080710/Alkkagi/issues/51) | [Design V1] 귀여운 알까기 아레나 — 게임형 로비·서비스 UI/UX 리뉴얼 | 이번 작업 종료 |
| [#52](https://github.com/SuperNova080710/Alkkagi/issues/52) | [Design V1][1/5] 브랜드 에셋·디자인 토큰·공통 화면 레이아웃 | 기존 완료 |
| [#53](https://github.com/SuperNova080710/Alkkagi/issues/53) | [Design V1][2/5] 시작 화면·로그인·게임형 대전 로비 | 기존 완료 |
| [#54](https://github.com/SuperNova080710/Alkkagi/issues/54) | [Design V1][3/5] 일반·랭크·AI 모드 선택과 대기실 진입 동선 | 이번 작업 종료 |
| [#55](https://github.com/SuperNova080710/Alkkagi/issues/55) | [Design V1][4/5] 게임판·채팅·턴 기록·승패 결과 귀여운 UI 통일 | 기존 완료 |
| [#56](https://github.com/SuperNova080710/Alkkagi/issues/56) | [Design V1][5/5] 랭킹·내 프로필·반응형·시각 회귀 검증 | 기존 완료 |
| [#57](https://github.com/SuperNova080710/Alkkagi/issues/57) | [Roadmap] 친구·메신저·XP/레벨·알/캐릭터 꾸미기·플레이어 프로필 | 이번 작업 종료 |
| [#59](https://github.com/SuperNova080710/Alkkagi/issues/59) | [Backend][Profile V1] 플레이어 검색·공개 프로필·공개 범위 API와 RLS | 기존 완료 |
| [#63](https://github.com/SuperNova080710/Alkkagi/issues/63) | [Security S1.1] 방 생성 RPC 원자적 사용자별 한도와 동시성 테스트 | 이번 작업 종료 |
| [#72](https://github.com/SuperNova080710/Alkkagi/issues/72) | [Backend Friends V1] 친구 요청·수락·거절·해제·차단 기반 | 이번 작업 종료 |
| [#73](https://github.com/SuperNova080710/Alkkagi/issues/73) | [Friends V1.1] DB 관계·차단·권한·동시성 RPC | 기존 완료 |
| [#74](https://github.com/SuperNova080710/Alkkagi/issues/74) | [Friends V1.2] 친구 시스템 API·입력 검증·문서 | 기존 완료 |
| [#75](https://github.com/SuperNova080710/Alkkagi/issues/75) | [Friends V1.3] CI·보안 회귀·병렬 개발 인계 | 기존 완료 |
| [#77](https://github.com/SuperNova080710/Alkkagi/issues/77) | [Backend DM V1] 친구 전용 1:1 실시간 메신저 시스템 | 이번 작업 종료 |
| [#78](https://github.com/SuperNova080710/Alkkagi/issues/78) | [DM V1.1] 메시지 스키마·RLS·RPC 및 Postgres Changes | 기존 완료 |
| [#79](https://github.com/SuperNova080710/Alkkagi/issues/79) | [DM V1.2] 1:1 메시지 HTTP 계약 및 입력·CSRF 검증 | 기존 완료 |
| [#80](https://github.com/SuperNova080710/Alkkagi/issues/80) | [DM V1.3] 친구 UI 채팅 인계·테스트·Preview 검증 | 기존 완료 |
| [#82](https://github.com/SuperNova080710/Alkkagi/issues/82) | [Backend Room Invite V1] 친구 대전방 초대·수락·만료·동시성 보호 | 이번 작업 종료 |
| [#83](https://github.com/SuperNova080710/Alkkagi/issues/83) | [Room Invite V1.1] 친구 초대 SQL·RLS·원자적 방 참가 | 기존 완료 |
| [#84](https://github.com/SuperNova080710/Alkkagi/issues/84) | [Room Invite V1.2] 초대 REST API·인증·CSRF·계약 문서 | 기존 완료 |
| [#85](https://github.com/SuperNova080710/Alkkagi/issues/85) | [Room Invite V1.3] CI·Preview·병렬 개발 인수 | 이번 작업 종료 |
| [#86](https://github.com/SuperNova080710/Alkkagi/issues/86) | [Design V2] 플레이어 검색·공개 프로필·공개 설정 UI 연동 | 이번 작업 종료 |
| [#87](https://github.com/SuperNova080710/Alkkagi/issues/87) | [Design V2] 플레이어 검색·공개 프로필 화면 | 기존 완료 |
| [#88](https://github.com/SuperNova080710/Alkkagi/issues/88) | [Design V2] 내 프로필 공개 설정 화면 | 기존 완료 |
| [#89](https://github.com/SuperNova080710/Alkkagi/issues/89) | [Design V2] 플레이어 UI 회귀·반응형 검증과 인계 | 기존 완료 |
| [#92](https://github.com/SuperNova080710/Alkkagi/issues/92) | [Design V3] 친구 요청·목록·차단 관리 UI | 이번 작업 종료 |
| [#93](https://github.com/SuperNova080710/Alkkagi/issues/93) | [Design V3] 친구 목록·요청·차단 화면 | 기존 완료 |
| [#94](https://github.com/SuperNova080710/Alkkagi/issues/94) | [Design V3] 공개 프로필 친구 요청·활성화 경계 | 기존 완료 |
| [#95](https://github.com/SuperNova080710/Alkkagi/issues/95) | [Design V3] 친구 UI 검증·인계 | 이번 작업 종료 |
| [#97](https://github.com/SuperNova080710/Alkkagi/issues/97) | [Docs] 전체 PR·이슈와 main 기준 문서 최신화 (2026-10-29) | 기존 완료 |
| [#98](https://github.com/SuperNova080710/Alkkagi/issues/98) | [Docs 97.1] README·계획·운영 인계 현행화 | 기존 완료 |
| [#99](https://github.com/SuperNova080710/Alkkagi/issues/99) | [Docs 97.2] 보안·친구·DM·UI 문서 상태 동기화 | 기존 완료 |
| [#100](https://github.com/SuperNova080710/Alkkagi/issues/100) | [Docs 97.3] 전체 이슈 상태·검증 잔여 과제 정합성 정리 | 기존 완료 |
| [#102](https://github.com/SuperNova080710/Alkkagi/issues/102) | [UI Density] PC 전체화면 비율·여백 축소와 페이지 세로 스크롤 개선 | 이번 작업 종료 |
| [#103](https://github.com/SuperNova080710/Alkkagi/issues/103) | [UI Density] PC 배치·밀도 조정 | 기존 완료 |
| [#104](https://github.com/SuperNova080710/Alkkagi/issues/104) | [UI Density] 전체화면·확대·모바일 시각 검증 | 이번 작업 종료 |
| [#105](https://github.com/SuperNova080710/Alkkagi/issues/105) | [Backend XP V1] 경험치 원장·레벨·중복 보상 방지 | 이번 작업 종료 |
| [#106](https://github.com/SuperNova080710/Alkkagi/issues/106) | [XP V1.1] 완료 경기 트리거·XP 원장·안티파밍·RLS | 기존 완료 |
| [#107](https://github.com/SuperNova080710/Alkkagi/issues/107) | [XP V1.2] 본인·공개 플레이어 XP 조회 API 및 계약 | 기존 완료 |
| [#108](https://github.com/SuperNova080710/Alkkagi/issues/108) | [XP V1.3] 보상 회귀·CI·디자인 채팅 인계 | 기존 완료 |
| [#111](https://github.com/SuperNova080710/Alkkagi/issues/111) | [Backend Cosmetics V1] 알·캐릭터 보유·해금·장착 시스템 | 이번 작업 종료 |
| [#112](https://github.com/SuperNova080710/Alkkagi/issues/112) | [Cosmetics V1.1] 카탈로그·보유·해금·장착 RPC와 RLS | 기존 완료 |
| [#113](https://github.com/SuperNova080710/Alkkagi/issues/113) | [Cosmetics V1.2] 내 인벤토리·장착·공개 외형 REST API | 기존 완료 |
| [#114](https://github.com/SuperNova080710/Alkkagi/issues/114) | [Cosmetics V1.3] CI·보안 회귀·디자인 개발 인계 | 기존 완료 |
| [#116](https://github.com/SuperNova080710/Alkkagi/issues/116) | [UI Lobby] 일반전·랭크전·AI 버튼 하단 공백 제거 | 기존 완료 |
| [#118](https://github.com/SuperNova080710/Alkkagi/issues/118) | [UI Lobby] 모드 카드·진행 중 경기 간격 및 이미지/버튼 정렬 | 이번 작업 종료 |
| [#120](https://github.com/SuperNova080710/Alkkagi/issues/120) | [UI Lobby] 아레나 좌·우 열 높이 균형 및 빈 공간 제거 | 기존 완료 |
| [#122](https://github.com/SuperNova080710/Alkkagi/issues/122) | [UI Hero] 1920×1080 와이드 화면 히어로 이미지 상하 잘림 개선 | 이번 작업 종료 |
| [#124](https://github.com/SuperNova080710/Alkkagi/issues/124) | [UI Hero] 와이드 배너 확대에 맞춘 타이틀·보조 텍스트 반응형 크기 조정 | 이번 작업 종료 |
| [#127](https://github.com/SuperNova080710/Alkkagi/issues/127) | [SEO S1.1] Next.js 메타데이터·canonical·미리보기 noindex 정책 | 기존 완료 |
| [#128](https://github.com/SuperNova080710/Alkkagi/issues/128) | [SEO S1.2] robots.txt·sitemap.xml·개인 데이터 비색인 | 기존 완료 |
| [#129](https://github.com/SuperNova080710/Alkkagi/issues/129) | [SEO S1.3] 검색 콘솔 등록 인계·디자인 협업·CI 검증 | 이번 작업 종료 |
| [#130](https://github.com/SuperNova080710/Alkkagi/issues/130) | [SEO Content] 공개 알까기 규칙·조작법·FAQ 페이지 및 홈 내부 링크 (UI 담당) | 이번 작업 종료 |
| [#132](https://github.com/SuperNova080710/Alkkagi/issues/132) | [UI Guide][#130-1] 공개 가이드 화면·규칙·FAQ·반응형 디자인 | 기존 완료 |
| [#133](https://github.com/SuperNova080710/Alkkagi/issues/133) | [UI Guide][#130-2] 홈페이지 내부 링크·회귀 테스트·SEO 인수 | 기존 완료 |
| [#134](https://github.com/SuperNova080710/Alkkagi/issues/134) | [Docs] 10/30 최신 PR·이슈 상태와 운영 인수 문서 동기화 | 기존 완료 |
| [#135](https://github.com/SuperNova080710/Alkkagi/issues/135) | [Docs 134.1] README·plan v7·운영 인수 최신 상태 갱신 | 기존 완료 |
| [#136](https://github.com/SuperNova080710/Alkkagi/issues/136) | [Docs 134.2] GitHub 이슈·계약 문서 구현 상태 정합화 | 기존 완료 |
| [#139](https://github.com/SuperNova080710/Alkkagi/issues/139) | [Design V4] 친구 전용 1:1 메신저 목록·대화 UI 연동 | 이번 작업 종료 |
| [#140](https://github.com/SuperNova080710/Alkkagi/issues/140) | [Design V4.1] 메신저 목록·대화·전송 UI | 기존 완료 |
| [#141](https://github.com/SuperNova080710/Alkkagi/issues/141) | [Design V4.2] 친구 동선·메신저 기능 플래그·반응형 | 기존 완료 |
| [#142](https://github.com/SuperNova080710/Alkkagi/issues/142) | [Design V4.3] 메신저 계약 테스트·CI·인수 | 기존 완료 |
| [#145](https://github.com/SuperNova080710/Alkkagi/issues/145) | [Release R1.1] Vercel 자동 Preview 제한과 수동 RC 배포 | 기존 완료 |
| [#146](https://github.com/SuperNova080710/Alkkagi/issues/146) | [Release R1.2] develop·release 대상 CI 및 경합 회귀 보존 | 기존 완료 |
| [#147](https://github.com/SuperNova080710/Alkkagi/issues/147) | [Release R1.3] 버전·Release Candidate·QA 운영 매뉴얼 | 기존 완료 |
| [#149](https://github.com/SuperNova080710/Alkkagi/issues/149) | [Design V5] 경험치·레벨 진행률 및 보상 내역 프로필 UI | 이번 작업 종료 |
| [#150](https://github.com/SuperNova080710/Alkkagi/issues/150) | [Design V5.1] 본인 XP·레벨 카드·최근 보상 내역 | 이번 작업 종료 |
| [#151](https://github.com/SuperNova080710/Alkkagi/issues/151) | [Design V5.2] 공개 플레이어 레벨 UI·계약 테스트·릴리스 인수 | 이번 작업 종료 |
| [#152](https://github.com/SuperNova080710/Alkkagi/issues/152) | [Docs D3] 2026-10-30 병합 기능·릴리스 정책·이슈 운영 현황 동기화 | 기존 완료 |
| [#153](https://github.com/SuperNova080710/Alkkagi/issues/153) | [Docs 152.1] 개발 현황·릴리스 규칙·운영 인수 문서 최신화 | 기존 완료 |
| [#154](https://github.com/SuperNova080710/Alkkagi/issues/154) | [Docs 152.2] 메신저·SEO·XP/코스메틱 계약과 이슈 상태 정합화 | 기존 완료 |
| [#155](https://github.com/SuperNova080710/Alkkagi/issues/155) | [Ops R2] Production PostgreSQL 17 마이그레이션 004~009 사전 점검·릴리스 게이트 | 이번 작업 종료 |
| [#156](https://github.com/SuperNova080710/Alkkagi/issues/156) | [Ops R2.1] 운영 DB 읽기 전용 사전 점검 SQL·카탈로그/RLS/Realtime 상태표 | 이번 작업 종료 |
| [#157](https://github.com/SuperNova080710/Alkkagi/issues/157) | [Ops R2.2] 읽기 전용 사전 점검 PGlite/정적 테스트 및 회귀 | 이번 작업 종료 |
| [#158](https://github.com/SuperNova080710/Alkkagi/issues/158) | [Ops R2.3] 롤아웃 STOP 조건·DB/SEO 릴리스 인계 및 QA 게이트 | 이번 작업 종료 |
| [#162](https://github.com/SuperNova080710/Alkkagi/issues/162) | [UI Cosmetics V1] 내 알·캐릭터 인벤토리/장착/미리보기 | 이번 작업 종료 |
| [#163](https://github.com/SuperNova080710/Alkkagi/issues/163) | [UI Cosmetics V1.1] 장착/잠금/해금 인벤토리 페이지 | 이번 작업 종료 |
| [#164](https://github.com/SuperNova080710/Alkkagi/issues/164) | [UI Cosmetics V1.2] 6종 미리보기·아레나 반응형 진입/테스트 | 이번 작업 종료 |
| [#165](https://github.com/SuperNova080710/Alkkagi/issues/165) | [UI Cosmetics V1.3] 일반·랭크·AI 경기 보드에 장착 알 외형 반영 | 이번 작업 종료 |
| [#166](https://github.com/SuperNova080710/Alkkagi/issues/166) | [Ops R3] PostgreSQL 17 격리 환경에서 004~009 전체 마이그레이션·권한·XP/코스메틱 실증 | 이번 작업 종료 |
| [#168](https://github.com/SuperNova080710/Alkkagi/issues/168) | [Ops R3.1] PG17 004~009 통합 SQL·권한/RLS/XP·꾸미기 검증 | 이번 작업 종료 |
| [#169](https://github.com/SuperNova080710/Alkkagi/issues/169) | [Ops R3.2] PostgreSQL17 서비스 CI 및 Quality 통합 검증 | 이번 작업 종료 |
| [#170](https://github.com/SuperNova080710/Alkkagi/issues/170) | [Ops R3.3] 운영 PG17 차이·릴리스 단계 STOP 조건/인계 | 이번 작업 종료 |
| [#174](https://github.com/SuperNova080710/Alkkagi/issues/174) | [Ops R4] 무료 로컬 Supabase Auth·Realtime·RLS 통합 E2E 자동화 | 이번 작업 종료 |
| [#175](https://github.com/SuperNova080710/Alkkagi/issues/175) | [Ops R4.1] GitHub 일회용 Supabase CLI/Auth/Realtime/PostgREST 실행·원격 차단 | 이번 작업 종료 |
| [#176](https://github.com/SuperNova080710/Alkkagi/issues/176) | [Ops R4.2] 실제 Auth JWT 2계정·친구/DM/Realtime·RLS·초대·XP·코스메틱 E2E | 이번 작업 종료 |
| [#177](https://github.com/SuperNova080710/Alkkagi/issues/177) | [Ops R4.3] 무료 환경 E2E·운영 적용 분리 문서·CI 최종 인계 | 이번 작업 종료 |
| [#179](https://github.com/SuperNova080710/Alkkagi/issues/179) | [UI V6] 친구 방 초대·수락 화면과 일반전 대기실 3D 디자인 통일 | 이번 작업 종료 |
| [#180](https://github.com/SuperNova080710/Alkkagi/issues/180) | [Ops R5] PostgreSQL 17 일회용 백업·복원 리허설과 RLS/데이터 무결성 게이트 | 이번 작업 종료 |
| [#182](https://github.com/SuperNova080710/Alkkagi/issues/182) | [Ops R5.1] 합성 친구·DM·초대·XP·장착 백업 및 새 DB 복원 검증 SQL | 이번 작업 종료 |
| [#183](https://github.com/SuperNova080710/Alkkagi/issues/183) | [Ops R5.2] pg_dump 커스텀 아카이브→pg_restore 재해복구 CI 격리 | 이번 작업 종료 |
| [#184](https://github.com/SuperNova080710/Alkkagi/issues/184) | [Ops R5.3] Free 운영 백업 제한/릴리스 STOP 게이트 인수 | 이번 작업 종료 |
| [#195](https://github.com/SuperNova080710/Alkkagi/issues/195) | [UI QA #104-1] 실제 Chromium 공개화면 뷰포트·오버플로 자동 측정 게이트 | 기존 완료 |
| [#199](https://github.com/SuperNova080710/Alkkagi/issues/199) | [UI QA #179-1] 대기실 역할별 SSR 게이트·초대 터치영역 회귀 검증 | 기존 완료 |
| [#201](https://github.com/SuperNova080710/Alkkagi/issues/201) | [UI QA #194.1] 메신저 SQL 응답 계약 수정 및 6영역 통합 격리 회귀 검증 | 기존 완료 |
| [#204](https://github.com/SuperNova080710/Alkkagi/issues/204) | [Release v0.2.0 / 1] RC 브랜치·버전·변경 이력과 배포 중단 체크리스트 | 기존 완료 |
| [#205](https://github.com/SuperNova080710/Alkkagi/issues/205) | [Release v0.2.0 / 2] release → main Draft PR과 필수 5종 CI 게이트 확인 | 기존 완료 |
| [#209](https://github.com/SuperNova080710/Alkkagi/issues/209) | [UI QA v0.2.0] 로비·프로필 ‘준비 중’ 문구를 기능 플래그와 동기화 | 이번 작업 종료 |
| [#213](https://github.com/SuperNova080710/Alkkagi/issues/213) | [UI] 메인 로비 내 정보 카드에 컴팩트 레벨·XP 진행률 표시 | 이번 작업 종료 |
| [#226](https://github.com/SuperNova080710/Alkkagi/issues/226) | [Docs 216.2] 완료 구현 이슈 종료 및 운영/릴리스 열린 이슈 재정비 | 기존 완료 |

## PR·브랜치 처리 원칙

- 현 기준 열린 PR: [#231](https://github.com/SuperNova080710/Alkkagi/pull/231) (`develop` 대상), [#230](https://github.com/SuperNova080710/Alkkagi/pull/230) (`develop` 대상), [#229](https://github.com/SuperNova080710/Alkkagi/pull/229) (`release/v0.2.0` 대상), [#228](https://github.com/SuperNova080710/Alkkagi/pull/228) (`develop` 대상).
- 이미 병합된 기능 PR의 head 브랜치가 존재하거나 삭제돼도 원래 구현 근거는 **merged_at 및 실제 커밋**으로 판단. **브랜치가 없다는 이유만으로 미완료 이슈를 닫지 않습니다.**
- 운영 SQL 004~009는 **2026-11-02 적용 완료**. 과거 미적용 기록은 당시 스냅샷으로 분리. 동일 SQL 재실행 금지.
- `main` Production과 `develop` 기능, `release/v0.2.0` RC는 서로 다릅니다. [v0.2.0 Draft #207](https://github.com/SuperNova080710/Alkkagi/pull/207)은 실제 QA·Production 승인 전 미병합입니다.
- 이슈 상태 기록 및 본 문서 작업의 정확한 후속은 [#216](https://github.com/SuperNova080710/Alkkagi/issues/216), [전체 현황](current-status-2026-11-03.md)을 참고하세요.

이 문서는 **이슈 상태/문서 조회 결과**이며 운영 SQL·GitHub 관리자 규칙·Vercel 환경 설정이나 실제 브라우저 QA의 실행 증거가 아닙니다.
