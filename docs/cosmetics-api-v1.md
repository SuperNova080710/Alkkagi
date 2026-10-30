# Cosmetics V1 — 데이터 시스템·UI 연동 계약

작업: [상위 #111](https://github.com/SuperNova080710/Alkkagi/issues/111) · DB [#112](https://github.com/SuperNova080710/Alkkagi/issues/112) · API [#113](https://github.com/SuperNova080710/Alkkagi/issues/113) · 검증 [#114](https://github.com/SuperNova080710/Alkkagi/issues/114).

**상태:** `feat/backend-cosmetics-v1`의 미병합 시스템 PR입니다. `main`/운영 Supabase의 테이블·RLS를 변경하지 않았습니다. UI 디자인·SVG/일러스트·CSS·게임 물리엔진 수정 없음.

## 역할 분리 및 선행 조건

- 시스템은 아이템 코드, 슬롯, **보유·해금·장착 데이터**만 관리합니다.
- 디자인 채팅은 각 코드에 맞는 알/캐릭터 이미지·아이콘·애니메이션 및 프로필/대기실 UI를 담당합니다. **새 이미지·에셋의 실체가 이미 구현됐다는 뜻이 아닙니다.**
- 이번 `202610290009_cosmetics_v1.sql`은 기존 프로필 공개 설정 `003`과 랭크 `006`을 선행 요구하지만, 경험치 [병합된 PR #110](https://github.com/SuperNova080710/Alkkagi/pull/110) / `008`은 GitHub main에 포함됐지만 **운영 Supabase에 자동 적용되지는 않습니다**. 코스메틱은 008 적용 전에도 동작하도록 개발됐습니다.
- 경험치 테이블 `public.player_progress`가 **없으면 Lv.1로 처리해 레벨 아이템을 잠급니다**. XP 마이그레이션이 적용되면 서버에서 최신 누적 XP로 레벨을 계산해 자동 해금합니다. 클라이언트가 XP/랭크 승수를 제출하는 API는 없습니다.

## 코스메틱 기본 카탈로그

| 코드 | 슬롯 | 해금 조건 | 설명 |
| --- | --- | --- | --- |
| `piece-classic` | piece | Starter | 기본 알 · 첫 로그인 시 지급 |
| `piece-forest` | piece | Ranked wins ≥ 1 | 숲빛 알 |
| `piece-starlight` | piece | XP level ≥ 3 | 별빛 알 |
| `avatar-classic` | avatar | Starter | 기본 캐릭터 · 첫 로그인 시 지급 |
| `avatar-bronze` | avatar | Ranked wins ≥ 3 | 청동 캐릭터 |
| `avatar-orbit` | avatar | XP level ≥ 2 | 궤도 캐릭터 |

**아이템 코드는 안정적인 API 식별자**로, UI는 코드→에셋 경로 매핑을 직접 관리합니다. DB에는 이미지 URL, 디자인 파일, 모션/렌더링 설정이 저장되지 않습니다.

## API

로그인 필수. 모든 응답은 `Cache-Control: private, no-store`, `Vary: Cookie`. 성공 `{data}`, 오류 `{error}`.

| 메서드 | URL | 입력 | 응답 |
| --- | --- | --- | --- |
| GET | `/api/cosmetics/me` | 없음 | `{loadout,items,rankedWins,level}` |
| PUT | `/api/cosmetics/equip` | `{"itemCode":"piece-forest"}` | `{pieceCode,avatarCode}` |
| GET | `/api/cosmetics/players/:id` | 플레이어 UUID | `{userId,pieceCode,avatarCode}` |

내 목록 예시:

```json
{
  "data": {
    "loadout": {"pieceCode":"piece-classic","avatarCode":"avatar-classic"},
    "rankedWins":0,
    "level":1,
    "items":[
      {
        "code":"piece-classic",
        "slot":"piece",
        "name":"기본 알",
        "description":"첫 로그인부터 사용할 수 있는 알",
        "unlockKind":"starter",
        "requiredValue":0,
        "owned":true,
        "equipped":true,
        "unlockedAt":"2026-10-29T06:00:00Z"
      }
    ]
  }
}
```

예시는 일부 항목만 포함하며 실제 목록은 **공개된 아이템 전부**를 표시합니다. 기본 스타터 2개는 `owned:true`, `equipped:true`; 나머지는 조건 충족 전 `owned:false`입니다. `unlockedAt`은 미보유일 때 `null`입니다.

### 오류

| HTTP | error | 의미 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 로그인 필요 |
| 403 | `ORIGIN_NOT_ALLOWED` | 다른 출처의 수정 요청 차단 |
| 400 | `INVALID_REQUEST`, `INVALID_COSMETIC_ITEM`, `INVALID_PLAYER_ID` | 본문·코드·ID 형식 오류 |
| 404 | `COSMETIC_NOT_AVAILABLE` | 없는/비공개 카탈로그 아이템 |
| 404 | `PLAYER_NOT_FOUND` | 없는 사용자·검색 비공개 사용자 동일 처리 |
| 404 | `PROFILE_NOT_FOUND` | 본인 프로필 레코드 없음 |
| 409 | `COSMETIC_LOCKED` | 해금되지 않아 장착 불가 |
| 503 | `COSMETIC_SERVICE_UNAVAILABLE` | 적용되지 않은 DB 마이그레이션·일시적 장애, 내부 SQL 메시지 노출 안 함 |

PUT 요청은 `Origin` 동일 출처, `Content-Type: application/json`, **2KiB** 이내 JSON, 정확한 단일 `itemCode` 필드만 허용합니다.

## 보안과 상태 관리

1. DB의 `public.cosmetic_items`는 공개 상태 `published=true`인 레코드만 인증 사용자 SELECT 가능. **장착 후 운영자가 `published=false`로 변경한 아이템은 본인·타인 RPC의 `pieceCode`/`avatarCode` 응답에서 각 기본 코드(`piece-classic`/`avatar-classic`)로 대체**되며 카탈로그에서도 제외합니다. 저장된 장착 행과 보유권은 유지하여 재공개 시 이전 선택이 복원될 수 있습니다. 기본 스타터 코드 자체는 상시 공개 상태로 유지해야 합니다.
2. `public.player_cosmetic_inventory`에는 소유자/아이템 코드 UNIQUE. 보유 해금은 DB RPC에서 랭크 승수 또는 누적 XP로 평가합니다.
3. `public.player_cosmetic_loadouts`에는 소유자당 **알 1개·캐릭터 1개**. 아이템 코드+슬롯 및 사용자+보유품에 대한 복합 FK로 잘못된 슬롯·미보유 장착을 DB 자체에서도 거부합니다.
4. 모든 테이블 RLS ON. 클라이언트 역할은 본인 인벤토리/장착 목록 읽기 가능하지만 직접 INSERT/UPDATE/DELETE 권한 없음. 제한된 3개 Auth RPC만 상태 변경·공개 조회.
5. 스타터 지급·조건 해금·기본 장착 생성은 **`get_my_cosmetics()` 호출 시 지연 동기화**됩니다. 최초 프로필 화면 진입 때 한 번 호출하고, 경기 종료 후 재조회해야 갱신됩니다.
6. 보유 해금은 영구적입니다. 이미 조건 달성해 보유한 아이템은 승수·XP가 변하더라도 회수하지 않습니다. 이미 장착한 같은 코드를 다시 장착하면 결과가 멱등합니다.
7. 타인 공개 외형 조회는 기존 프로필 `discoverable`을 확인합니다. 비공개 사용자와 미존재 사용자는 똑같이 404. 타인의 인벤토리·해금 시각·조건 달성량은 공개하지 않습니다.
8. 코스메틱은 **시각적인 코드일 뿐** 충돌 반경·질량·샷 계산·랭크 RP에 영향을 주지 않습니다. 무료 아이템 해금만 제공하며 상점/가챠/현금 재화는 범위 밖입니다.

## 디자인 채팅 구현 인계

- 플레이어 설정에서 `GET /api/cosmetics/me`로 인벤토리 및 현재 장착을 조회합니다. `items[].owned`가 true일 때만 장착 버튼 활성화.
- 장착 버튼은 `PUT /api/cosmetics/equip`로 코드 전달. 성공 시 반환 `loadout`으로 화면 업데이트.
- 다른 사람의 아바타/알은 `GET /api/cosmetics/players/:id`의 **두 개 코드**를 사용해 렌더링. 서버가 현재 비공개 아이템을 기본 코드로 대체하며, 프론트도 반드시 정적 매핑에 등록된 안전한 asset만 보여주고 모르는 코드면 starter fallback 사용.
- 디자인 소유 파일: `src/app/**/page.tsx`, `src/components/**`, `src/app/globals.css`, `src/app/arena.css`, `src/app/layout.tsx`, `public/art/**`. 본 시스템 PR은 해당 파일들 일절 변경하지 않음.
- 기능의 운영 활성화는 별도 작업입니다. `009` DB 적용·실계정 권한/E2E 전에는 사용자에게 완료된 기능으로 표시하지 않습니다.

## 인수/미검증

- [ ] GitHub CI lint/typecheck/PGlite·HTTP/Build 최종 통과
- [ ] Vercel Preview 최신 SHA READY(Free 배포 횟수 제한 시 상태 구분)
- [ ] 운영 Supabase `009` 적용·2계정 브라우저 E2E 및 XP `008` 연동/랭크 승리 재현
- [ ] 독립 PostgreSQL 16 다중 연결 장착 경합과 게시 상태 변경 공개 범위 테스트 (`tests/cosmetics-concurrency.sql`, CI 결과 성공 후 완료 표시). PGlite 단일 연결과 구분

**사용자 지시: PR 작성까지만 진행하고 main 병합 및 운영 Supabase DDL을 적용하지 않습니다.**

## 병합 및 운영 인수 상태 (2026-10-30)

- 코스메틱 API/SQL [PR #115](https://github.com/SuperNova080710/Alkkagi/pull/115)는 **main 병합 완료**. 통합 Quality 46개 테스트 파일·231개 테스트 및 PG16 독립 연결 장착 경합/게시 비공개 외형 마스킹 검사 통과(병합 PR 기록).
- `202610290009_cosmetics_v1.sql` 운영 적용, 실제 로그인 사용자 아이템 해금·장착, 안전한 외형 에셋/UI 및 Production/Realtime E2E는 **확인되지 않았습니다**. 본문 과거 'PR 작성까지만/미병합' 문구는 해당 작업 브랜치 기준 기록입니다.
- XP 레벨 조건 아이템은 **선행 SQL 008** 및 실제 XP 보상을 필요로 합니다. 백엔드 병합만으로 사용자에게 코스메틱 기능이 제공된다고 표시하지 마세요.
- 신규 UI 작업과 설정·에셋 구현은 디자인 담당 이슈에서 별도로 분리하고, 릴리스 정책상 `develop` 대상 PR로 진행합니다.
