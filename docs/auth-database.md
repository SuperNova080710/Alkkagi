# Issue #5 — 인증과 DB 접근 경계

## 구현

- `/signup`: 이메일/비밀번호/확인 입력 → Server Action → Supabase Auth.
- `/login`: 비밀번호 로그인. 원문 Auth 오류는 화면에 노출하지 않는다.
- `/auth/callback`: PKCE code 교환. 성공 시 고정 `/lobby`, 실패 시 `/login?error=callback`.
- `/lobby`: `getUser()`로 Supabase Auth 서버에서 검증된 사용자만 렌더링.
- 로그아웃: POST Server Action으로 현재 브라우저 세션 종료, Router Cache 무효화.
- Next.js 16 `src/proxy.ts`: 만료 세션 갱신, 요청과 응답 양쪽에 쿠키 반영, `private, no-store`.
- public 홈은 환경변수 없이도 열린다. 설정 누락 시 인증 폼 비활성화, 보호 페이지는 로그인으로 이동한다.
- Auth에는 publishable key만 사용한다. 비밀번호/토큰 로그, DB 비밀번호 저장, 클라이언트 점수 쓰기는 없다.

## Vercel/Supabase에서 적용할 설정

1. 이 구현은 `feat/p1-core-match`에 있다. PR #17을 `main`에 병합하기 전에는
   main 프로덕션 배포에 포함되지 않는다. 먼저 해당 브랜치의 Preview에서 확인한다.
2. Vercel의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 확인한다.
3. 서버 전용 `SITE_URL`을 배포의 원점으로 설정한다. 미설정 기본값은
   `https://alkkagi-alpha.vercel.app`이다. 로컬은 `http://localhost:3000`이다.
   Preview에서 가입을 테스트할 때는 Preview의 실제 주소로 지정한다. 요청의 Host 헤더로
   인증 이메일 주소를 만들지 않는다.
4. Supabase Authentication → URL Configuration의 Site URL은 프로덕션 원점으로 유지한다.
   Redirect URLs에 `https://alkkagi-alpha.vercel.app/auth/callback`을 추가한다.
   로컬/Preview 테스트에는 해당 원점의 `/auth/callback`도 각각 추가한다.
5. Email provider를 사용한다. 이메일 확인은 유지할 수 있다. 기본 Confirm signup
   이메일 템플릿의 `{{ .ConfirmationURL }}` 링크가 PKCE 확인 후 callback으로 돌아온다.
   사용자 지정 템플릿이 이미 있다면 원래 링크 구성을 확인한다.
6. 환경변수를 변경하면 새 배포를 만든다. 이름이 같더라도 잘못된 Supabase 프로젝트의
   키가 연결되어 있지 않은지 대시보드에서 확인한다.

가입 시 사용한 브라우저에서 이메일 링크를 연다(PKCE verifier 쿠키 필요).
다른 브라우저로 열어 교환이 실패했어도 이메일 인증 자체가 완료됐다면 로그인할 수 있다.
기본 Supabase 메일 발송 서비스는 수신 대상/빈도 제한이 있으므로 외부 사용자 가입을
공개하기 전 Custom SMTP와 메일 발송 정책을 확인한다. 본 작업에서 SMTP는 설정하지 않았다.

## 마이그레이션 적용

`supabase/migrations/202610280001_initial_schema.sql`을 검토하고 프로젝트에 1회 적용한다.
Supabase CLI를 사용하는 경우 프로젝트 연결 후 `supabase db push`를 실행한다.
CLI가 없다면 SQL Editor에서 해당 파일 전체를 실행할 수 있다. 두 방법을 중복 실행하지 않는다.
SQL Editor로 적용했다면 이후 CLI 도입 시 migration history를 먼저 맞춘다.
실제 원격 실행은 이 작업 환경에서 수행하지 않았다. 기존 동명 테이블이 있다면 먼저 차이를 검토한다.

| 테이블 | 클라이언트 SELECT | 클라이언트 쓰기 |
|---|---|---|
| profiles | 본인만 | 전부 거부 |
| rooms | 본인이 참가한 방 | 전부 거부 |
| room_players | 본인 참가 행 | 전부 거부 |
| matches | 해당 경기 참가자 | 전부 거부 |
| shots | 해당 경기 참가자 | 전부 거부 |

비로그인은 모든 테이블 접근을 거부한다. 가입 트리거는 기본 프로필을 생성하고 기존 사용자를
backfill한다. 닉네임·역할·RP를 사용자 메타데이터로 받지 않는다. 같은 방의 상대 프로필과
입장 명단은 후속 서버 API가 필요한 공개 필드만 제공한다. 공개 랭킹은 P2에서 별도 설계한다.

seat 1/2와 (room, seat)/(room, user), 방 코드, (match, turn)/(match, request) 유니크 제약을 둔다.
신뢰된 service_role은 쓰기가 가능하지만 현재 서비스 키 클라이언트/변경 API는 만들지 않았다.
#6의 방 입장 원자적 처리와 샷 턴 예약 RPC는 후속 구현이다. RLS만으로 서버 API의
사용자 소유권·턴·멱등성 검증을 대체하지 않는다.

## 검증과 한계

`npm run check`로 lint/typecheck/Vitest/build를 수행한다.
- Auth 테스트: 입력, 가입 확인, 오류, 성공 redirect, 로그아웃, 보호 페이지, 콜백과 쿠키 갱신.
- DB 테스트: PGlite의 실제 PostgreSQL SQL/RLS 엔진에서 auth.users/auth.uid와 역할을 모사한다.
  A/B 본인 프로필 격리, 참가자 조회, 제3자/비로그인 차단, 점수·보드 직접 변경 거부,
  중복 제약과 신뢰된 서버 쓰기를 검증한다. Supabase Auth·PostgREST 통합 테스트는 아니다.
- 로컬 무설정 HTTP 검증: 홈/로그인/가입 200, 로비 307 → 로그인, 잘못된 콜백 → 오류 안내.
- 미검증: 실제 프로젝트 SQL 적용, 실메일 확인, 브라우저 새로고침/세션 만료/로그아웃,
  원격 PostgREST 교차 접근, 동시 방 입장·샷 요청, 실제 Vercel 서비스 응답.

## 배포 후 수동 검증

1. A/B 계정을 각각 다른 브라우저 프로필로 가입하고 이메일 확인 후 로그인한다.
2. 각 로비가 자기 이메일만 표시하고 새로고침 후에도 유지되는지 확인한다.
3. A 로그아웃 후 새로고침/로비 직접 접근이 로그인으로 돌아가는지, B 로그인은 유지되는지 확인한다.
4. 잘못된 비밀번호, 미확인 이메일, 만료/재사용된 링크가 성공 상태로 진행되지 않는지 확인한다.
5. SQL 적용 후 각 사용자 JWT로 profiles를 조회해 본인만 반환되는지 확인한다.
6. 사용자 JWT로 rating·matches 변경과 shots 삽입을 요청해 거부되는지 확인한다.

공식 참고: https://supabase.com/docs/guides/auth/server-side/creating-a-client
및 https://supabase.com/docs/guides/auth/passwords
