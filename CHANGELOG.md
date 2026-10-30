# Changelog

릴리스한 버전별 주요 변경사항을 기록합니다. 코드가 `main`에 존재한다고 해서 자동으로 릴리스 태그가 발행된 것은 아닙니다.

이 문서는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)와 [Semantic Versioning](https://semver.org/)을 참고합니다.

## [Unreleased]

### Added
- 친구 1:1 메신저 화면과 대화·읽음 동선 (#143), 기본 기능 플래그 OFF.
- XP·레벨 보상 원장/조회 API (#110) 및 코스메틱 보유·해금·장착 API (#115). DB 008/009 운영 적용은 별도.
- 공개 알까기 가이드·FAQ (#137) 및 기술 SEO 메타·robots·sitemap (#131). Search Console 등록은 별도.
- `develop` 통합 브랜치와 `release/vX.Y.Z` 기반 릴리스 프로세스.
- 릴리스 후보에서만 수동 Vercel Preview 검증하는 운영 가이드.

### Changed
- 기능 PR `develop` 대상, 승인된 RC는 `release/vX.Y.Z`에서 `main`으로 병합하는 릴리스 정책 (#148).
- Git 자동 배포는 `main`만 허용하도록 정책 설정.
- `develop` / `release/**` PR에서도 기존 Quality 및 5종 PostgreSQL 경합 테스트(방 생성·초대·DM·XP·코스메틱) 실행.

**검증 경계:** 위 내용은 병합된 코드의 **미출시 변경 기록**입니다. 운영 SQL 004~009·실제 기능 플래그/Production 배포·사용자 E2E는 완료했다고 주장하지 않습니다.

## Release policy
- 최초 릴리스 기준 버전은 배포와 Production 확인 후 확정합니다. 기존 `package.json`의 `0.1.0`을 이미 배포·태깅된 공식 릴리스로 소급 주장하지 않습니다.
- 매 릴리스의 `Added / Changed / Fixed / Security` 항목과 GitHub Release를 실제 확인된 증거로 작성합니다.
