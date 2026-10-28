# Alkkagi Arena

브라우저에서 친구와 1:1 알까기를 즐기고 랜덤 랭크 매칭과 순위표에서 경쟁하는 웹게임입니다.

> **현재 상태 (2026-10-28): P1 제출 완료, P2·P3 구현/DB/CI/Production 반영 완료.** 사용자가 일반전·랭크전, RP·리더보드, 재접속·턴 제한, 키보드/모바일 조작과 화면 안정성의 정상 작동을 보고했습니다. 운영 DB에서 일반전 완료 6회·랭크전 완료 1회·RP 정산 +16/-16을 확인했습니다. **ALEPH 중간 점검 2차 및 최종 제출 접수는 아직 확인되지 않았습니다.**

## 사용 방법

1. [공개 서비스](https://alkkagi-alpha.vercel.app)에서 두 개의 서로 다른 계정으로 로그인합니다.
2. A가 로비에서 방을 만들고 8자리 초대 코드를 B에게 전달합니다. B가 코드로 참가합니다.
3. A가 경기를 시작하면 각 5개의 알로 드래그 발사를 번갈아 진행합니다. 마지막 알을 제거하거나 기권하면 승패가 확정됩니다.

**검증 상태:** 사용자 실사용 점검 정상(2026-10-28), GitHub Actions `10dfced` 성공, Vercel Production READY, Supabase 랭크 RP 원장 2건 확인. 자동화 테스트와 사용자 확인은 별도 출처이며 외부 검사기관 인증을 의미하지 않습니다.

## 구현 범위와 검증

| 영역 | 상태 |
| --- | --- |
| Supabase Auth·프로필·RLS | 구현, 운영 DB 기본 테이블 확인 |
| 코드방 생성·참가·퇴장 | 구현, PostgreSQL 마이그레이션 적용 |
| 물리 엔진·5대5 보드·서버 턴 판정 | 구현, GitHub Actions 테스트 통과 |
| Supabase Realtime | publication 등록, 구독+스냅샷 폴링 구현 |
| P1 중간 점검 1차 제출 | 완료(사용자 보고) |
| P2 랜덤 매칭·RP·리더보드 | 구현·DB·Production 및 실계정 플레이 정상 보고; 중간 점검 2차 제출 대기 |
| P3 타임아웃·보안·키보드 입력 | 구현·DB·Production 및 실사용 정상 보고; 보안 설정 추가 점검 및 최종 제출 대기 |

자세한 내용은 [P1 구현 기록](docs/p1-implementation.md), [P2 랜덤 매칭·정산](docs/p2-ranked.md), [P3 복구 계획](docs/p3-recovery.md), [검증 및 인수 기록](docs/acceptance-2026-10-28.md)을 참고합니다.

## 랭크전 이용 방법

1. 로그인 후 로비에서 **랭크 아레나**에 입장합니다.
2. 두 계정에서 **랭크 매칭 시작**을 선택합니다. 매칭되면 랭크 경기 화면으로 이동합니다.
3. 승패 또는 기권으로 경기를 종료하고 랭크 로비에서 RP·승패·리더보드를 확인합니다.

동일 RP의 두 플레이어가 대결해 한 명이 승리하면 일반적으로 **+16 / -16 RP**가 적용됩니다. 일반전 결과는 RP에 반영되지 않습니다. 자동 CI 및 실제 사용자 검증을 별도로 기록했습니다. 2026-10-28 사용자가 랭크/일반전 기능 정상 작동을 보고했고 운영 DB에서 RP +16/-16 정산을 확인했습니다.

---

## 프로젝트 목표

- **1:1 알까기:** 턴제 물리 판정, 양측 동기화, 한 판 완료
- **대전 진입:** 초대 코드 기반 일반전 방 / 랜덤 랭크 매칭
- **경쟁:** Elo 기반 랭크 포인트, 리더보드, 대전 기록

## 예정 기술 스택

Next.js (App Router) · React · TypeScript · Supabase (Auth / PostgreSQL / Realtime) · Vercel

- 서버가 샷·턴·승패를 검증합니다. 브라우저가 점수나 승패를 직접 결정하지 않습니다.
- 랭크 포인트는 **랭크전에서만** 반영합니다. 초대방 일반전은 비랭크전입니다.
- 게임 상태의 기준은 PostgreSQL에 저장된 확정 스냅샷입니다.
- MVP는 1:1, 알 5개씩, 드래그 발사 방식입니다. 물리 엔진은 서버에서 결과를 확정하며, 발사 세기는 8~125 범위를 1차 밸런스 값으로 사용합니다.

## ALEPH 앱 프로젝트 진행

| 단계 | 구현 범위 | 완료 기준 |
| --- | --- | --- |
| P1 | 로그인, 방 만들기·참가, 알까기 물리 엔진, 턴 동기화 | 배포 URL에서 서로 다른 두 계정이 일반전 1회 완료 |
| P2 | 랜덤 랭크 매칭, RP 정산, 랭킹·전적 | 랭크 매치 결과가 전적·RP·리더보드에 일관되게 반영 |
| P3 | 이탈/재접속, 모바일·연출, 보안·테스트·문서 | 두 기기 검증 및 공개 서비스 재현 절차 충족 |

작업 기록은 GitHub Issues / Pull Requests로 관리합니다. 큰 단계마다 별도 브랜치를 만들고 PR 리뷰 및 검증 후 병합합니다.

### 개발 절차

1. 목표를 ALEPH에 저장하고 `plan.md` v1 업로드
2. P1 기본 게임 → 공개 배포 확인 → 중간 점검 1차 제출
3. P2 랜덤 매칭 및 랭크 → 실제 계정 검증 → 점검 2차 제출
4. P3 품질·복구·보안 강화 → 최종 제출

> 계획·실제 구현·테스트·배포 여부를 구분해 기록합니다. 프로젝트 상세 설계는 작업 브랜치에서 `plan.md`로 관리합니다.

## 로컬 실행 — Issue #4

Node.js 24.x와 npm을 사용합니다. `.nvmrc`가 제공됩니다.

```sh
nvm use
npm ci
npm run dev
```

`http://localhost:3000`에서 시작 화면을 확인합니다. 시작 화면은 환경변수 없이도 표시됩니다. 실제 로그인·방·대전은 Supabase 환경변수 설정이 필요합니다.
로컬 인증을 시험하려면 `.env.example`을 `.env.local`로 복사하고 공개 설정과 `SITE_URL=http://localhost:3000`을 설정합니다.
`SUPABASE_SECRET_KEY`는 서버 전용이며 브라우저 코드에서 사용하면 안 됩니다.

## 품질 검사

```sh
npm run lint       # ESLint, 경고도 실패 처리
npm run typecheck  # Next.js 라우트 타입 생성 후 TypeScript 검사
npm test           # SSR·인증 경계·쿠키·DB RLS 검증
npm run build      # 프로덕션 빌드
# 전체 검사
npm run check
```

`npm run start`는 빌드 완료 후 프로덕션 서버를 실행합니다.
GitHub Actions도 Node.js 24에서 `npm ci`와 동일한 전체 검사를 실행합니다.
인증 단위 테스트와 로컬 PostgreSQL RLS 테스트를 포함합니다. 실제 Supabase 스키마 적용과 PostgreSQL 원자적 매칭/RP 검증은 별도 기록으로 구분합니다. 실제 두 계정 E2E도 별도입니다.

## 코드 구조와 배포 준비

- `src/app/layout.tsx`: 한국어 문서, 메타데이터, 전역 스타일
- `src/app/page.tsx`: 구현 상태를 명시하는 초기 홈 화면
- `tests/`: Vitest 테스트
- `.env.example`: 값이 비어 있는 환경변수 목록

Vercel에서 이 저장소를 연결하고 Framework Preset을 **Next.js**, Root Directory를
저장소 루트, Node.js를 **24.x**로 지정합니다. Install Command는 `npm ci`,
Build Command는 `npm run build`입니다. Output Directory는 기본값을 사용합니다.
Next.js 자동 감지를 사용하므로 별도의 `vercel.json`은 필요하지 않습니다.
실제 Vercel Production(https://alkkagi-alpha.vercel.app)과 Supabase 프로젝트 연결이 완료됐습니다.

### 의존성 참고

Next.js ESLint 설정에 포함된 React/import/accessibility 플러그인의 peer 범위가
ESLint 9까지이므로 `eslint@9.39.5`를 고정했습니다. 설치 시 지원 종료 경고가
출력됩니다. 플러그인이 ESLint 10을 지원하면 함께 업그레이드해야 합니다.

## 인증·DB 연결 — Issue #5

설정, SQL 적용, 테스트 범위와 배포 후 점검은 [docs/auth-database.md](docs/auth-database.md)를 따릅니다.
