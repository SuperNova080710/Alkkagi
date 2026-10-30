# Production 004~009 마이그레이션 사전 점검 및 롤아웃 인계

작성일: 2026-10-30 KST · 상위 이슈 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155), SQL [#156](https://github.com/SuperNova080710/Alkkagi/issues/156), 테스트 [#157](https://github.com/SuperNova080710/Alkkagi/issues/157), 인계 [#158](https://github.com/SuperNova080710/Alkkagi/issues/158). 릴리스 정책 [#144](https://github.com/SuperNova080710/Alkkagi/issues/144).

> 이 문서는 **운영 적용을 지시하거나 허가하는 문서가 아닙니다**. 코드 병합, Vercel READY, 테스트 통과, Supabase DDL 적용 및 실계정 E2E는 구분합니다. 사용자 승인 없는 DB 쓰기·배포·기능 플래그 변경 금지.

## 검증된 현재 상태

2026-10-30 읽기 전용 Supabase 조회:

- 운영 프로젝트: Supabase 연결된 Alkkagi 프로젝트(`igjvccohxthmgbfilzxi`). **PostgreSQL 17.11** (기존 GitHub 독립 연결 경합 CI의 PG16과 다름).
- `supabase_migrations.schema_migrations`의 지원되는 마이그레이션 목록에는 `player_profile_discovery`까지 기록되어 있으며 **004~009 이력이 없음**. 기존 migration history는 SQL 소스 버전명과 대응 테이블이 다르므로 버전 숫자만으로 적용 상태를 판정하면 안 됩니다.
- 기초 `profiles`, `rooms`, `room_players`, `matches`, `ai_matches`, `player_profile_settings` 및 `supabase_realtime` publication이 존재함.
- **004:** `public.create_casual_room(text)`가 존재하더라도 **항상 `inspect`**로 판정합니다. 오류 메시지 문자열(실행되지 않는 코드·주석 포함)은 5개 활성방/10분당 10개 생성 제한이 실제 실행된다는 증거가 아닙니다.
- **005~009:** `friend_links`, `player_blocks`, `dm_threads`, `dm_messages`, `room_friend_invites`, `player_progress`, `xp_events`, `cosmetic_items`, `player_cosmetic_inventory`, `player_cosmetic_loadouts` 등은 없음. RPC, 트리거, DM Realtime 등록도 해당 단계 미적용.
- GitHub `main`과 `develop`은 조회 당시 **동일 SHA `8cf4dc06b5069f917a1604b53c50a73b1d8242fc`**. Vercel Production 최신 Deployment SHA도 이 값으로 READY. **외부 HTTP 200·Googlebot/브라우저 E2E는 별도 미검증**.
- SEO `/sitemap.xml` 소스에는 **`/`와 `/how-to-play` 2건**이 이미 존재. 검색 콘솔 인증·색인 확인은 사용자 Google 계정 단계.

## 읽기 전용 점검 재현

[사전점검 SQL](../supabase/checks/production-rollout-preflight.sql) 전체를 Supabase SQL Editor에서 실행합니다. 저장소의 SQL 파일은 SELECT CTE와 카탈로그 조회만 포함합니다. `auth.users` 이메일·토큰·사용자 메시지/게임 데이터·비밀 키를 조회하지 않습니다.

```text
category     stage  check_key                                status
object       base   public.profiles                           ready
object       base   public.rooms                              ready
object       base   supabase_realtime                         ready
object       004    public.create_casual_room(text)           inspect
object       005    public.friend_links                       pending
object       006    public.dm_messages                       pending
realtime     006    supabase_realtime/dm_messages             pending
object       007    public.room_friend_invites                pending
object       008    public.player_progress                   pending
trigger      008    public.matches/xp_pvp_match_finished      pending
object       009    public.cosmetic_items                    pending
```

표는 일부 대표 결과이며 전체 검사에는 표·RPC·RLS·직접 쓰기 권한·트리거·publication을 포함합니다.

| status | 판정 | 다음 행동 |
| --- | --- | --- |
| `ready` | 해당 객체/보안 항목 존재 | migration history·실제 정의·데이터 제약 확인 후 다음으로 |
| `pending` | 아직 객체 없음 또는 기대되는 등록 누락 | 적용 전이면 정상. 앞선 단계는 모두 ready인데 개별 pending이면 **STOP**, 부분 적용 조사 |
| `blocked` | 기초 객체 누락, 존재하는 테이블의 RLS OFF/직접 쓰기 권한 열림, 익명 RPC 실행 허용 | **STOP**. 릴리스 및 기능 플래그 활성화 금지. 정책·권한 수정안 별도 PR |
| `inspect` | 기존 004 RPC 존재, 실제 제한 동작은 미검증(오류 문자열 존재와 무관) | **STOP**. 함수 정의·권한·migration history 대조와 별도 PostgreSQL 17 환경에서 5개 활성방/10분당 10개 제한 및 동시성 재현 결과를 확인한 후 수동 승인 |

**중요:** `ready`는 객체의 존재·일부 ACL만 확인합니다. 함수 본문의 정확성, 정책의 모든 조건, 시드 데이터, migration history를 증명하지 않습니다. **004는 오류 문자열을 전혀 판정에 사용하지 않고 존재 시 무조건 `inspect`를 반환합니다.** 사전점검 SQL만으로 004를 자동 `ready`로 바꿀 수 없으며, 마이그레이션 SHA/함수 정의 대조 및 별도 안전한 DB에서 제한·경합 동작 검증을 완료해야 운영 적용을 별도 승인할 수 있습니다. 운영 DB에 SQL이 일부 수동 적용됐거나 적용 이력과 달라지면 무조건 중지합니다.

### 004 상태의 수동 승인 근거

004 함수가 있는 상태는 `inspect`로 유지합니다. `ROOM_ACTIVE_LIMIT` / `ROOM_RATE_LIMIT` 문자열이 함수에 존재해도 `ready`로 바뀌지 않습니다. 운영 적용 전 마이그레이션 원본·배포 기록·현재 함수 정의가 일치하는지 확인하고, **실사용자 데이터와 분리된 PG17 호환 환경**에서 활성방 5개 제한, 10분당 생성 10개 제한, 동시 생성 경합 및 이전 방 생성 흐름을 검증한 근거를 별도 인수 문서에 남겨야 합니다. 근거가 없으면 **STOP**입니다. 사전점검 SQL은 실행 자체가 데이터를 수정하지 않는 점검 전용입니다.

## 실제 운영 적용 전 STOP 게이트

1. **승인 확인:** 이 대화에서는 SQL 적용하지 않습니다. 코드 PR은 `develop`으로만 제출. 별도 검토 채팅에서 PR 검사·릴리스 버전 승인·운영 적용 권한을 확인해야 합니다.
2. **버전 동결:** `release/vX.Y.Z`를 `develop`에서 분기. 포함된 004~009 파일의 SHA와 기능 플래그 기본값, 관련 API/Realtime 버전을 기록합니다.
3. **백업과 복구:** Supabase 데이터 및 스키마 백업·복구 가능 여부를 먼저 검증합니다. Free 플랜에서 백업 자동화/복구 범위를 임의로 가정하지 않습니다. 확보 불가하면 운영 마이그레이션 보류. Vercel 롤백으로 DB 데이터가 복구되지 않습니다.
4. **호환성:** 004~009는 운영 **PostgreSQL 17.11** 기준 별도 검증이 필요합니다. PGlite/PG16 GitHub Actions 성공만으로 PG17 운영 적합성을 확정하지 않습니다. Preview는 Production DB에 쓰지 않도록 **별도 프로젝트/DB**를 준비해야 합니다.
5. **의존성:** 기존 `003` 공개 프로필 RPC·테이블 및 P1~P3 경기/AI 테이블/Realtime publication 존재 확인. 중간 실패가 있으면 이후 SQL 실행 금지.
6. **보안:** 각 단계 직후 preflight 재실행 + RLS policies, privilege grants, 함수 소유자/search_path, Auth 세션·타인 권한 검증. 사전점검에서 `blocked`가 나오면 기능 활성화 중단.
7. **출시:** DB가 최종 확인될 때까지 `FRIENDS_UI_ENABLED`, `MESSAGES_UI_ENABLED`를 임의로 true로 바꾸지 않음. 사용자에게 완료 기능이라고 표시하지 않음.

## 승인 후 순차 적용·인수 순서

| 순서 | 파일·기능 | 적용 직후 읽기/경계 확인 | 실계정 통합 테스트 |
| --- | --- | --- | --- |
| 004 | `202610290004_security_room_create_limits.sql` | `create_casual_room` 5개 활성방/10분 10개 생성 제한, 익명 EXECUTE 거부, 기존 방 생성 경로 보존 | 한 계정 반복 생성과 여러 요청 간 경합 |
| 005 | `202610290005_friends_v1.sql` | 친구/차단 테이블 RLS, 인증 RPC만 쓰기 | 두 계정 요청/수락/거절/차단/친구 해제, 상대 프라이버시 |
| 006 | `202610290006_direct_messages_v1.sql` | DM 테이블 RLS/비인가 쓰기 차단, `supabase_realtime` 등록 | 친구 간 전송/멱등성/읽음/차단·친구 해제 직후 접근 금지, 실제 websocket 수신 |
| 007 | `202610290007_room_friend_invites_v1.sql` | 호스트/수신 초대 RPC 및 만료·상호 차단 권한 | 5분 만료/수락 seat2 배정, 코드 참가·AI 시작과 동시 경쟁 |
| 008 | `202610290008_xp_levels_v1.sql` | XP 원장/요약 및 `matches`/`ai_matches` 종료 트리거 | 일반/랭크/AI 결과, 중복 정산 금지, RP 원장 영향 없음, 과거 경기 소급 XP 없음 |
| 009 | `202610290009_cosmetics_v1.sql` | starter 2개 포함 카탈로그 시드·RLS·장착 FK | 랭크 승/XP 조건 해금, 본인만 장착, 비공개 외형 및 상대 보유 정보 미노출 |

006/007은 반드시 005 친구 관계를 먼저 요구합니다. 008/009는 현재 `main` 소스에 모두 병합되어 있고, 009의 XP 연동은 008의 player_progress로 연동됩니다. SQL은 **migration tool의 적용 기록과 객체 상태를 먼저 비교하여 실행**해야 합니다. SQL Editor에서 반복 전체 실행하지 마세요.

### 체크 후 운영 확인

- 각 SQL을 실제 적용한 담당자는 Supabase migration history와 객체 정의·RLS·anon/authenticated grants·Realtime publication·마이그레이션 성공 로그를 **일치시켜 기록**합니다.
- 실제 사용자 데이터가 있는 Prod에서 임의로 보상 지급이나 대전방 스팸 테스트를 수행하지 않습니다. 테스트용 별도 DB/프로젝트·계정을 사용하세요.
- 새로운 DB 및 UI 기능 게이트 활성화는 보안/실계정 승인 완료 이후 별도 배포/환경변수 변경 절차로 실행합니다.
- Vercel Production은 최신 `main` READY 상태지만 사이트/정식 도메인의 HTTP 응답, Search Console 속성·실제 Google 색인과는 별개입니다. SEO는 [인수 절차](google-search-seo.md)를 따릅니다.

## 코드·대화 간 소유권

- 시스템: `supabase/checks/**`, SQL·API/보안 테스트. 현재 [#155](https://github.com/SuperNova080710/Alkkagi/issues/155).
- 디자인: `src/app/**/page.tsx`, `src/components/**`, CSS, 사용자 인터랙션/시각 E2E. 이 PR에서는 전부 건드리지 않습니다.
- 문서 관리: 운영/현재 상태 문서 최신화 별도 작업, 이번 PR에는 위 인수 문서만 새로 추가.
- PR 검토/병합: 별도 채팅에서 진행. 병합 전까지 개발 브랜치 `develop`, 운영 `main`은 변경하지 않습니다.

## 검증의 한계

- [x] 운영 Supabase Catalog SELECT 조회: 위 결손 현황 확인. 실제 쓰기/DDL 0건.
- [ ] 최신 보완 HEAD의 GitHub Actions lint/typecheck/Vitest/Next.js build 확인(완료 시 실행 링크 기입).
- [ ] PostgreSQL 17 실제 신규 마이그레이션 적용·여러 연결 동시 테스트 (미실시).
- [ ] 2계정 Auth/Realtime/랭크·XP·꾸미기 E2E (미실시).
- [ ] Google Search Console 실제 소유권/색인 (미실시).

**이 문서와 사전점검 SQL을 실행해도 004~009가 운영에 자동 적용되지는 않습니다.**
