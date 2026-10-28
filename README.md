# Alkkagi Arena

브라우저에서 친구와 1:1로 알까기를 즐기고, 랜덤 랭크 매칭과 순위표에서 경쟁하는 온라인 게임 프로젝트입니다.

> **현재 상태: 프로젝트 스캐폴드 구현 단계.** 시작 화면과 품질 검사 구성을 추가했습니다. 게임 기능·실서비스 배포는 아직 완료되지 않았습니다.

## 프로젝트 목표

- **1:1 알까기:** 턴제 물리 판정, 양측 동기화, 한 판 완료
- **대전 진입:** 초대 코드 기반 일반전 방 / 랜덤 랭크 매칭
- **경쟁:** Elo 기반 랭크 포인트, 리더보드, 대전 기록

## 예정 기술 스택

Next.js (App Router) · React · TypeScript · Supabase (Auth / PostgreSQL / Realtime) · Vercel

- 서버가 샷·턴·승패를 검증합니다. 브라우저가 점수나 승패를 직접 결정하지 않습니다.
- 랭크 포인트는 **랭크전에서만** 반영합니다. 초대방 일반전은 비랭크전입니다.
- 게임 상태의 기준은 PostgreSQL에 저장된 확정 스냅샷입니다.
- MVP는 1:1, 알 5개씩, 드래그 발사 방식입니다. 물리 엔진·세부 규칙은 기술 검증 후 확정합니다.

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
3. P2 랜덤 매칭 및 랭크 → 점검 2차 제출
4. P3 품질·복구·보안 강화 → 최종 제출

> 계획·실제 구현·테스트·배포 여부를 구분해 기록합니다. 프로젝트 상세 설계는 작업 브랜치에서 `plan.md`로 관리합니다.

## 로컬 실행 — Issue #4

Node.js 24.x와 npm을 사용합니다. `.nvmrc`가 제공됩니다.

```sh
nvm use
npm ci
npm run dev
```

`http://localhost:3000`에서 시작 화면을 확인합니다. 현재 화면은 환경변수나
Supabase 연결 없이 실행됩니다. 로그인·방·대전은 아직 구현되지 않았습니다.
Supabase 연동 시 `.env.example`을 `.env.local`로 복사하고 실제 값을 설정합니다.
`SUPABASE_SECRET_KEY`는 서버 전용이며 브라우저 코드에서 사용하면 안 됩니다.

## 품질 검사

```sh
npm run lint       # ESLint, 경고도 실패 처리
npm run typecheck  # Next.js 라우트 타입 생성 후 TypeScript 검사
npm test           # 환경변수 없이 시작 화면 서버 렌더링 검증
npm run build      # 프로덕션 빌드
# 전체 검사
npm run check
```

`npm run start`는 빌드 완료 후 프로덕션 서버를 실행합니다.
GitHub Actions도 Node.js 24에서 `npm ci`와 동일한 전체 검사를 실행합니다.
인증·DB·경쟁 상태 테스트는 해당 기능 구현 이슈에서 추가합니다.

## 코드 구조와 배포 준비

- `src/app/layout.tsx`: 한국어 문서, 메타데이터, 전역 스타일
- `src/app/page.tsx`: 구현 상태를 명시하는 초기 홈 화면
- `tests/`: Vitest 테스트
- `.env.example`: 값이 비어 있는 환경변수 목록

Vercel에서 이 저장소를 연결하고 Framework Preset을 **Next.js**, Root Directory를
저장소 루트, Node.js를 **24.x**로 지정합니다. Install Command는 `npm ci`,
Build Command는 `npm run build`입니다. Output Directory는 기본값을 사용합니다.
Next.js 자동 감지를 사용하므로 별도의 `vercel.json`은 필요하지 않습니다.
실제 Vercel 배포와 Supabase 프로젝트 연결은 아직 수행하지 않았습니다.

### 의존성 참고

Next.js ESLint 설정에 포함된 React/import/accessibility 플러그인의 peer 범위가
ESLint 9까지이므로 `eslint@9.39.5`를 고정했습니다. 설치 시 지원 종료 경고가
출력됩니다. 플러그인이 ESLint 10을 지원하면 함께 업그레이드해야 합니다.
