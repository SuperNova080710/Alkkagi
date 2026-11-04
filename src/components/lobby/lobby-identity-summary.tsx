'use client';

import './lobby-identity-summary.css';
import { LobbyExperienceMini } from '@/components/lobby/lobby-experience-mini';
import { CosmeticPreview } from '@/components/cosmetics/cosmetic-preview';
import { isCosmeticInventory } from '@/components/cosmetics/cosmetic-api';
import { usePlayerResource } from '@/components/players/use-player-resource';

/** Single identity presentation shared by Alkkagi and Omok; only RP differs. */
export function LobbyIdentitySummary({ nickname, rating, game, experienceEnabled = false, cosmeticsEnabled = false }: {
  nickname: string;
  rating: number | null;
  game: 'alkkagi' | 'omok';
  experienceEnabled?: boolean;
  cosmeticsEnabled?: boolean;
}) {
  const { data: cosmetics, error, loading } = usePlayerResource<unknown>(
    cosmeticsEnabled ? '/api/cosmetics/me' : null,
  );
  const inventory = isCosmeticInventory(cosmetics) ? cosmetics : null;
  const ratingLabel = game === 'omok' ? '오목 RP' : 'RP';
  return <div className="arena-player-summary arena-player-summary--shared" aria-label="내 공통 프로필">
    <span className="arena-avatar" aria-hidden={!inventory}>
      {inventory
        ? <CosmeticPreview code={inventory.loadout.avatarCode} slot="avatar" compact/>
        : <span aria-hidden="true">●</span>}
    </span>
    <div className="arena-player-summary-copy">
      <p className="arena-nickname">{nickname}</p>
      <p className="arena-muted">{rating === null
        ? ratingLabel + '를 불러오지 못했어요'
        : rating.toLocaleString('ko-KR') + ' ' + ratingLabel}</p>
      {experienceEnabled && <LobbyExperienceMini/>}
      {cosmeticsEnabled && loading && <span className="arena-lobby-identity-hint" role="status">아바타 확인 중</span>}
      {cosmeticsEnabled && !loading && (error != null || !inventory) &&
        <span className="arena-lobby-identity-hint" role="status">기본 아바타로 표시 중</span>}
    </div>
  </div>;
}
