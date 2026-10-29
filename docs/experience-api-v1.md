# Experience & Levels V1 — 시스템·UI/UX 연동 계약

GitHub: 상위 [#105](https://github.com/SuperNova080710/Alkkagi/issues/105) · DB [#106](https://github.com/SuperNova080710/Alkkagi/issues/106) · API [#107](https://github.com/SuperNova080710/Alkkagi/issues/107) · 검증 [#108](https://github.com/SuperNova080710/Alkkagi/issues/108).

**상태:** 브랜치 `feat/backend-xp-levels-v1`에서 구현. `main`/운영 Supabase DB에는 아직 적용되지 않은 별도 PR 작업입니다. UI 컴포넌트/스타일·경기 물리엔진/기존 정산 RPC를 변경하지 않았습니다.

## 보상 방식 (서버 권위)

신규 `202610290008_xp_levels_v1.sql`에 XP 원장 `xp_events` + 누적 요약 `player_progress` 테이블 추가. PostgreSQL `AFTER UPDATE OF status` 트리거로 **active → finished** 전환일 때만 지급하며 기존 RP 정산과 같은 트랜잭션에서 처리합니다. 클라이언트/게임 API에서는 XP 값을 전달하지 않습니다.

| 경기 종류 | 승리 | 패배 | 무승부 |
| --- | ---: | ---: | ---: |
| 일반전(친구·코드 대전) | 40 XP | 20 XP | 25 XP |
| 랭크전 | 70 XP | 35 XP | 50 XP |
| AI Easy | 10 XP | 0 XP | — |
| AI Normal | 15 XP | 0 XP | — |
| AI Hard | 20 XP | 0 XP | — |

- 일반전과 랭크전은 **합산하여 사용자당 UTC 하루 최대 20경기**까지만 XP 획득.
- **동일 상대 일반전은 사용자당 UTC 하루 최대 5경기**까지만 XP 획득. 랭크전에는 동일 상대 제한을 적용하지 않지만 합산 20경기 제한은 동일.
- AI 경기는 **UTC 하루 10경기**까지만 XP 획득. 패배는 보상 0 XP지만 경기 수를 셉니다.
- 해당 제한을 넘으면 XP 0 지급 원장을 남겨 추후 중복/남용 여부를 추적합니다. 한도는 매일 UTC 00:00 초기화.
- 한 경기는 `(source_kind,source_id,user_id)` UNIQUE로 원장에 최대 한 번 저장하며 같은 경기의 반복 종료/HTTP 재요청도 중복 XP를 발생시키지 않습니다.
- **과거 이미 끝난 경기는 소급 보상하지 않습니다.** 추가된 트리거 이후 완료된 경기부터 적립됩니다.
- **RP(랭크 점수)는 기존 Elo 계산 그대로**입니다. XP는 RP/승패 통계와 분리되어 독립 저장됩니다.
- 몰수·턴 초과 종료도 경기의 최종 `winner_id`를 기준으로 보상합니다. 승리한 다른 사용자 역시 XP를 받습니다.
- 서버 내부 경로에서 진행된 AI/일반전/랭크전 `finished` 변경도 감지합니다. 시작 전 방 종료·대기 취소·버그로 인한 `abandoned` 상태는 보상을 주지 않습니다.

## 레벨 공식

기본 Lv.1, 초기 경험치 0. 누적 XP가 **`100 × (Lv−1)²`**에 도달할 때 해당 레벨이 됩니다. XP는 절대 차감하지 않습니다.

| 레벨 | 진입에 필요한 누적 XP |
| --- | ---: |
| 1 | 0 |
| 2 | 100 |
| 3 | 400 |
| 4 | 900 |
| 5 | 1,600 |

`currentLevelXp`는 현재 레벨 시작점으로부터 누적한 XP이며, `nextLevelCost`는 다음 레벨까지의 **이번 레벨 구간 전체 요구량**입니다. UI 진행 게이지는 `currentLevelXp / nextLevelCost`로 계산합니다. `nextLevelAt`은 다음 레벨에 도달하는 누적 XP입니다.

## REST API

**GET 전용**이므로 사용자 입력으로 경험치를 늘리는 API는 없습니다. 모든 API는 Supabase Auth의 검증된 로그인 사용자만 호출할 수 있습니다.

| 메서드 | URL | 응답 |
| --- | --- | --- |
| GET | `/api/experience/me` | 본인 `{data:{userId,totalXp,level,currentLevelXp,nextLevelCost,nextLevelAt,recentRewards}}` |
| GET | `/api/experience/players/:id` | 공개 허용 사용자의 누적 XP·레벨·게이지 필드. **타인의 `recentRewards`는 null** |

성공 `{data}`, 실패 `{error:'CODE'}`; 응답 `Cache-Control: private, no-store`, `Vary: Cookie`.

```json
{
  "data": {
    "userId": "11111111-1111-4111-8111-111111111111",
    "totalXp": 180,
    "level": 2,
    "currentLevelXp": 80,
    "nextLevelCost": 300,
    "nextLevelAt": 400,
    "recentRewards": [
      {
        "id": "4",
        "sourceKind": "ranked",
        "sourceId": "22222222-2222-4222-8222-222222222222",
        "outcome": "win",
        "earnedXp": 70,
        "createdAt": "2026-10-29T08:00:00Z"
      }
    ]
  }
}
```

`recentRewards`: 본인만 조회 가능, 최근 최대 20개. 상대방 이름·이메일·RP는 포함하지 않습니다. `id`는 PostgreSQL bigint이므로 **문자열**입니다. `totalXp`도 bigint이나 응답 JSON 숫자로 직렬화됩니다. 극단적으로 2⁵³을 넘어가면 JS 정밀도가 제한될 수 있지만 현재 보상 한도 내에서는 현실적인 문제가 아닙니다.

### 오류 / 공개 범위

| 상태 | 코드 | 의미 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 로그인 필요 |
| 400 | `INVALID_PLAYER_ID` | 공개 플레이어 ID UUID 형식 오류 |
| 404 | `PLAYER_NOT_FOUND` | 미존재 또는 검색 비공개 사용자 (구별 금지) |
| 503 | `XP_SERVICE_UNAVAILABLE` | DB가 마이그레이션되지 않았거나 서비스 오류, 내부 SQL 문구 비노출 |

`get_player_experience(p_player_id)`는 DB에서도 `auth.uid()` 및 기존 `player_profile_settings.discoverable`를 확인합니다. 자신의 기록은 비공개 설정과 무관하게 조회 가능합니다. 타인의 보상 원장과 다른 원본 프로필 행에 대한 직접 읽기는 기존 RLS 및 인가 정책으로 차단됩니다.

## 디자인 채팅 인계

- 프로필/플레이어 카드에서 로그인 사용자의 레벨·총 XP·진행률만 표시하도록 선택할 수 있습니다.
- 자기 프로필은 `GET /api/experience/me`, 타인 프로필은 `GET /api/experience/players/:id` 이용. **XP를 클라이언트에서 계산·수정·지급하지 마세요.**
- 완료 경기 화면은 게임 완료 이벤트가 있으면 XP API를 **재조회**합니다. XP는 완료 경기 트랜잭션 안에서 적립되므로 별도 지급 버튼 없음.
- XP API의 오류/미적용 상태는 `준비 중` 또는 비활성으로 처리. 신규 UI의 출시 전에는 프로필·레벨을 기능이 운영 중인 것처럼 표시하지 않음.
- UI 소유: `src/app/**/page.tsx`, `src/components/**`, `src/app/globals.css`, `src/app/arena.css`, `src/app/layout.tsx`. 본 시스템 PR은 신규 SQL/REST/tests/docs 및 `src/proxy.ts` matcher만 수정.
- 메신저/친구 초대 PR #81/#90 및 기존 RP/대전 로직과 별도 상태를 유지합니다.

## QA와 적용 경계

- [ ] PGlite: 원장·레벨·RLS·중복·한도·AI/랭크/일반전
- [ ] HTTP: 본인·공개/비공개·익명·에러·no-store
- [ ] GitHub Actions 전체 lint/typecheck/Vitest/Next.js build
- [ ] Vercel Preview 최신 SHA READY (무료 플랜 배포 제한 시 미검증 명시)
- [ ] 실제 PostgreSQL 독립 연결 동시 종료와 운영 두 계정 E2E (아직 미실시)
- [ ] 운영 DB 004~008 선행 migration 기록/테이블 확인, 실제 적용은 사용자 별도 승인 후

**PR 작성까지만 진행합니다. 병합하거나 운영 Supabase 데이터베이스에 SQL을 적용하지 않습니다.**
