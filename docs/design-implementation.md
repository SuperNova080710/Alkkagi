# 디자인 구현 현황 및 시스템 작업 경계

2026-10-29 · 상위 #51 · 사용자 PC/모바일 시안 승인 후 구현.

## 공통 기반 #52

- 브랜치 `feat/52-brand-foundation`.
- `src/app/arena.css`: `.arena` 아래에서만 적용되는 크림/에메랄드/우드 테마.
- `src/components/ui/arena.tsx`: ArenaShell / ArenaHero / ArenaModeCard / ArenaPanel.
- `src/app/layout.tsx`: 전용 스타일 import만 추가. 기존 globals.css와 경기 레이아웃 유지.
- `public/art/{hero,casual,ranked,ai}.webp`: 자체 생성한 장식 일러스트, 글자/버튼은 HTML.
- 에셋 제작: built-in imagegen, 2026-10-29. 프롬프트 방향: 목재 탁자와 숲, 녹색·주황·파랑 유리알 마스코트 / 일반전 두 알 / 금빛 메달 / AI 로봇. UI·글자 없는 독립 에셋으로 생성 후 WebP 최적화.
- 이미지에는 사용자 데이터나 실제 게임 판정 정보를 포함하지 않음.

## 시스템 담당이 확인할 계약

- 디자인에서 `supabase/**`, `src/lib/**`, 서버 actions/API는 수정하지 않음.
- #54 로비 AI 바로 시작에는 서버 계약 필요: difficulty 입력, 성공 room id/redirect, 중복 요청 및 생성 후 시작 실패 복구.
- 계약 전에는 기존 방 생성 → 대기실 AI 추가를 사용하며 바로 시작 완료로 표시하지 않음.
- 공유 페이지/컴포넌트의 수정 예약과 상태는 #51~#56 이슈가 기준. 시작/커밋/PR/검증 시 기록.
- DB·인증·매칭·RP·물리·채팅 의미 변경은 별도 시스템 PR에서 처리.

## 검증 경계

현재 기반은 opt-in이며 실제 페이지 적용은 #53 이후. 시각 회귀 결과와 실제 연동 결과는 각 PR에 별도 기록. 테스트용 빈 데이터/fixtures는 운영 데이터가 아님.
