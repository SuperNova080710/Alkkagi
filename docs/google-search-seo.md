# Alkkagi Arena — Google 검색 등록 및 기술 SEO

2026-10-29 / [상위 이슈 #126](https://github.com/SuperNova080710/Alkkagi/issues/126) / 구현 #127·#128 / 인수 #129.

## 목표와 한계

이 작업은 `https://alkkagi-alpha.vercel.app`의 **Google 검색 발견 가능성(크롤링/색인)**을 개선합니다. 검색 결과 **1위·상단 노출을 약속하는 작업은 아닙니다**. Google은 순위를 수백 가지 신호로 결정하고, 사이트맵을 제출해도 반드시 크롤링·색인되지 않습니다.

공식 문서:
- [Google 검색 기술 요구사항](https://developers.google.com/search/docs/essentials/technical)
- [Google 사이트맵과 색인 안내](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google URL 재크롤링 요청 절차](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [Next.js Metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)

## 구현 범위

| 항목 | 구현 | 적용 위치 |
| --- | --- | --- |
| 한국어 게임 제목·소개 | 브라우저 온라인 1:1 알까기, 친구방·AI·랭크 기능 설명 | `src/lib/seo/site.ts`, `src/app/layout.tsx` |
| 단일 정식 주소(canonical) | `https://alkkagi-alpha.vercel.app/` | 홈 `src/app/page.tsx`의 metadata export만 |
| 링크 공유/검색 메타 | `metadataBase`, Open Graph, Twitter summary, description | `src/app/layout.tsx` |
| Google 소유권 확인 | 선택적 `GOOGLE_SITE_VERIFICATION` 메타 태그 | `src/app/layout.tsx` |
| robots.txt | production·preview의 HTML 크롤링 허용(비색인 헤더 확인용), `/api/`·`/auth/` 크롤링 제한 | `src/app/robots.ts` |
| sitemap.xml | production 공개 홈페이지 1건만 | `src/app/sitemap.ts` |
| 검색 비색인 | private 페이지/로그인/가입: `X-Robots-Tag: noindex,nofollow` | `next.config.ts` |
| 중복 Preview 방지 | Vercel Preview/개발 환경 전체 noindex(응답 헤더·메타). robots는 HTML을 허용해 이를 읽게 함 | 위 metadata/robots/next.config |
| QA | production/preview 분기, sitemap 내용, 사적 경로 헤더 테스트 | `tests/seo.test.ts` |

검색 대상은 **공개 홈페이지 1개**입니다. 로그인 후 플레이어 프로필, 방 번호, 경기, 개인 정보, API URL은 사이트맵에 절대 넣지 않습니다. 로그인/가입, 로비·랭크·방·프로필·플레이어 검색·친구 목록 등의 **HTML 경로는 robots.txt에서 크롤링을 허용**하되, HTTP `X-Robots-Tag: noindex, nofollow`로 색인을 금지합니다. 크롤러가 해당 헤더를 읽어야 검색 결과 제외가 유효하기 때문입니다. 기존 페이지/컴포넌트의 화면 배치나 텍스트·스타일은 건드리지 않았습니다.

## 크롤링과 색인 정책 — PR #131 리뷰 보완

Google 공식 문서에서 **robots.txt는 색인 차단 도구가 아니며**, `noindex`가 작동하려면 Googlebot이 해당 URL의 응답 헤더/HTML에 접근할 수 있어야 한다고 설명합니다.
- [noindex로 색인 차단하기](https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=ko)
- [robots.txt 소개](https://developers.google.com/search/docs/crawling-indexing/robots/intro?hl=ko)

| URL 종류 | Production robots | Production 비색인 | Preview/개발 |
| --- | --- | --- | --- |
| 공개 홈 `/` | Allow | noindex 없음, sitemap에 1건 | robots Allow + 전역 noindex |
| `/login`, `/signup` | Allow | X-Robots-Tag noindex,nofollow | robots Allow + 전역 noindex |
| `/lobby`, `/ranked`, `/rooms/*`, `/profile/*`, `/players/*`, `/friends/*` | Allow | X-Robots-Tag noindex,nofollow | robots Allow + 전역 noindex |
| `/api/*`, `/auth/*` | Disallow (트래픽 관리) | X-Robots-Tag도 지정하지만 robots로 차단되어 검색엔진이 확인한다고 보장할 수 없음 | Disallow + 전역 noindex, 같은 제약 |
| `/sitemap.xml` | Allow | 공개 홈만 안내 | 빈 사이트맵 |

**보안 경계:** robots.txt의 Allow/Disallow는 접근 권한 설정이 아닙니다. 로그인 필수 페이지와 API에 대한 실제 데이터 보호는 Auth, 서버 측 권한 검사, Supabase RLS가 수행합니다. Preview URL이 공개로 접근되는 경우에도 `noindex`는 검색 색인 설정일 뿐 비밀 유지 수단이 아닙니다. Preview 환경의 전체 응답은 별도 `X-Robots-Tag` 및 메타 태그로 noindex 처리합니다.

**검증 방법:** Production에서 `/`은 `noindex` 헤더가 없어야 하고, `/login`·`/rooms/유효한ID` 같은 HTML 응답(로그인 리디렉션이 있다면 최종 응답 포함)에는 `noindex`가 적용되어야 합니다. Preview에서도 HTML 접근이 robots 정책으로 가로막히지 않으며 `noindex` 응답을 확인해야 합니다. GitHub 단위 테스트는 정책 함수와 설정값을 확인하지만, 실제 HTTP 응답과 Search Console의 Googlebot 크롤링 검증을 대신하지 않습니다.

## 배포 및 Google Search Console 등록

**PR이 검토·병합되고 Vercel production 배포가 완료된 후** 아래를 순서대로 실행합니다. PR 또는 Preview가 존재하는 것만으로 Google 검색에 자동 등록되는 것은 아닙니다.

1. 브라우저의 시크릿 창에서 [정식 사이트](https://alkkagi-alpha.vercel.app/) 열기: 로그인 없이 홈페이지가 열려야 합니다. 응답은 HTTP 200이어야 하고, 홈에는 `X-Robots-Tag: noindex`가 없어야 합니다. Vercel Deployment Protection이 production 페이지를 가로막는 경우 해당 도메인을 공개하도록 설정해야 합니다.
2. [robots.txt](https://alkkagi-alpha.vercel.app/robots.txt)에서 `Allow: /`, `Disallow: /api/`, `Disallow: /auth/`와 `Sitemap: https://alkkagi-alpha.vercel.app/sitemap.xml` 확인. **HTML 경로 `/lobby`, `/rooms`, `/players` 등은 Disallow에 포함하지 않습니다.** [sitemap.xml](https://alkkagi-alpha.vercel.app/sitemap.xml)에서 홈 주소 한 건 확인.
3. [Google Search Console](https://search.google.com/search-console/welcome)에서 **URL 접두어(URL prefix)** → `https://alkkagi-alpha.vercel.app/` 속성을 추가합니다. `vercel.app`의 DNS 전체에 대한 권한을 요구하는 도메인 속성이 아니라 URL 접두어 방식으로 설정합니다.
4. 소유권 확인에서 **HTML 태그** 방식을 선택합니다. 예: `<meta name="google-site-verification" content="YOUR_TOKEN" />`. `YOUR_TOKEN` **값만** Vercel 해당 프로젝트의 환경 변수 `GOOGLE_SITE_VERIFICATION`에 production 범위로 넣습니다. 검증 토큰은 GitHub 소스에 직접 커밋하지 않습니다.
5. production을 다시 배포하고 페이지 소스에서 `google-site-verification` meta가 실제로 출력되는지 확인한 다음 Search Console의 **확인** 버튼을 누릅니다. HTML 확인 토큰을 제거하면 확인이 해제될 수 있으므로 보존합니다. Vercel Free 배포 한도에 걸리면 제한이 해제된 후 진행합니다.
6. Search Console 왼쪽 **Sitemaps(사이트맵)** → `sitemap.xml` 입력 → 제출. 이어서 상단 **URL 검사**에서 `https://alkkagi-alpha.vercel.app/` 입력 → 실시간 테스트 → **색인 생성 요청**.
7. Search Console **페이지 색인 생성 / 실적** 보고서에서 색인됨·차단 사유, '알까기 아레나', '온라인 알까기', '친구 알까기 게임' 등 검색어 노출수·클릭수·평균 게재순위를 주기적으로 확인합니다.

**검색 반영은 며칠에서 몇 주 이상 걸릴 수 있습니다.** Google은 색인 시점을 보장하지 않으며 사이트맵 제출이나 색인 요청 자체가 순위를 올리는 직접적인 수단은 아닙니다.

### 권한과 작업 경계

- GitHub/Vercel/ Supabase 계정 연결만으로 **Google Search Console 소유권 확인이 완료되는 것은 아닙니다**. Google 계정에서 해당 속성을 추가하고 확인을 눌러야 합니다.
- 이 대화에서는 사용자 Google 계정 접근·Search Console 제출·production 배포를 수행하지 않았습니다.
- 정식 서비스에 이미 다른 검색엔진 robots 파일이나 Search Console 태그가 설정되어 있다면 병합 전에 중복/충돌을 확인합니다.

## 상단 노출을 위한 후속 콘텐츠 과제 (디자인/콘텐츠 담당)

현재 홈페이지에는 게임 소개와 대전 진입 버튼이 있습니다. 기술 SEO 이후에는 **검색 사용자가 궁금해할 실제 설명**을 공개 페이지에 추가하는 쪽이 효과를 볼 가능성이 있습니다.

- **알까기 규칙과 조작법**: 승리 조건, 알 5개, 드래그 세기/방향, 친구 코드 참가, 랭크전·AI 난이도 차이를 실제 게임 상태에 맞게 설명. 반복 키워드 나열 대신 신규 이용자가 게임을 쉽게 이해할 수 있게 작성.
- **접근 가능한 공개 소개 콘텐츠**: 로그인 없이 볼 수 있는 게임 플레이 설명과 FAQ, 내부 링크를 가진 경량 `/how-to-play` 페이지 또는 홈페이지 소개 섹션. 페이지/이미지는 디자인 담당 이슈로 분리.
- **신뢰 신호 및 측정**: 외부 공식 소개/포트폴리오 등 자연스러운 실제 링크, Search Console 실적과 모바일 페이지 성능 측정, 공개 페이지 접근성 개선.
- '알까기 아레나' 같은 **고유 서비스명 검색**은 일반적인 '알까기' 검색보다 경쟁이 좁을 수 있지만 상위 검색 결과를 보장하지는 않습니다. 과도한 키워드 채우기·유료 링크 구매·순위 보장 서비스 이용은 권장하지 않습니다.

## 검증 및 롤아웃

- [ ] 최종 HEAD GitHub CI: lint/typecheck/Vitest/Next.js build (검증 후 실행 링크 기록)
- [ ] 운영 HTTP 응답: `/login`·`/rooms/*`·Preview의 `X-Robots-Tag`, robots.txt와의 비충돌 확인
- [ ] 최종 HEAD Vercel Preview: 무료 한도와 Deployment Protection에 따른 실제 READY 확인
- [ ] PR 리뷰·main 병합 후 production: 공개 HTTP 200, robots/sitemap/HTML 메타·noindex 헤더 검사
- [ ] **사용자 소유 Google Search Console**: HTML 태그 인증, 사이트맵 제출, URL 색인 요청 및 보고서 모니터링

**이 브랜치 작업은 PR 작성까지만이며 production 배포와 Google 검색 색인 완료를 주장하지 않습니다.**
