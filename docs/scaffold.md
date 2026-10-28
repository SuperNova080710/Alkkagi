# Issue #4 — 프로젝트 스캐폴드

## 범위

기존 P1 브랜치에 Next.js App Router, React, strict TypeScript, Tailwind CSS,
ESLint, Vitest와 GitHub Actions를 추가한다. 인증·DB·물리 판정은 후속 이슈다.
첫 화면은 개발 중임을 표시하며 동작하지 않는 로그인/대전 버튼을 노출하지 않는다.
API와 DB 스키마 변경은 없다. 환경변수 없이 렌더링할 수 있다.

## 재현

Node.js 24.x에서 `npm ci`, `npm run check`를 실행한다.
`npm run build` 후 `npm run start`로 홈 200과 없는 경로 404를 확인한다.
테스트는 시작 화면의 SSR과 개발 중 안내를 확인한다. 경쟁 상태 테스트는
공유 상태와 DB가 도입되는 후속 이슈에서 구현한다.

## 후속 작업

- #5: Supabase 인증 연결 및 세션 관리
- 실제 Vercel 프로젝트 연결과 배포 검증
- ESLint 관련 플러그인의 v10 지원 후 의존성 업그레이드

로컬 검증 결과와 커밋은 PR #17에 기록한다. 원격 CI, 브라우저 시각 검증,
두 계정 대전, 실제 서비스 배포는 별도 검증이며 로컬 빌드 성공으로 대체하지 않는다.
