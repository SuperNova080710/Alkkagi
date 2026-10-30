# Changelog

릴리스한 버전별 주요 변경사항을 기록합니다. 코드가 `main`에 존재한다고 해서 자동으로 릴리스 태그가 발행된 것은 아닙니다.

이 문서는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)와 [Semantic Versioning](https://semver.org/)을 참고합니다.

## [Unreleased]

### Added
- `develop` 통합 브랜치와 `release/vX.Y.Z` 기반 릴리스 프로세스.
- 릴리스 후보에서만 수동 Vercel Preview 검증하는 운영 가이드.

### Changed
- Git 자동 배포는 `main`만 허용하도록 정책 설정.
- `develop` / `release/**` PR에서도 기존 Quality 및 5종 PostgreSQL 경합 테스트(방 생성·초대·DM·XP·코스메틱) 실행.

## Release policy
- 최초 릴리스 기준 버전은 배포와 Production 확인 후 확정합니다. 기존 `package.json`의 `0.1.0`을 이미 배포·태깅된 공식 릴리스로 소급 주장하지 않습니다.
- 매 릴리스의 `Added / Changed / Fixed / Security` 항목과 GitHub Release를 실제 확인된 증거로 작성합니다.
