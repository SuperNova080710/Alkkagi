'use client';

import './lobby-identity-summary.css';
import { LobbyExperienceMini } from '@/components/lobby/lobby-experience-mini';
import { CosmeticPreview } from '@/components/cosmetics/cosmetic-preview';
import { isCosmeticInventory } from '@/components/cosmetics/cosmetic-api';
import { usePlayerResource } from '@/components/players/use-player-resource';

function LobbyCosmeticAvatar() {
  const { data, error, loading } = usePlayerResource<unknown>('/api/cosmetics/me');
  const inventory = isCosmeticInventory(data) ? data : null;
  return <div className="arena-player-avatar-stack">
    <span className="arena-avatar">
      {inventory
        ? <CosmeticPreview code={inventory.loadout.avatarCode} slot="avatar" compact/>
        : <span aria-hidden="true">●</span>}
    </span>
    {loading && <span className="arena-lobby-identity-hint" role="status">아바타 확인 중</span>}
    {!loading && (error != null || !inventory) &&
      <span className="arena-lobby-identity-hint" role="status">기본 아바타로 표시 중</span>}
  </div>;
}

/** One identity presentation across games, no resource hook while flags are OFF. */
export function LobbyIdentitySummary({ nickname, rating, game, experienceEnabled = false, cosmeticsEnabled = false }: {
  nickname: string;
  rating: number | null;
  game: 'alkkagi' | 'omok';
  experienceEnabled?: boolean;
  cosmeticsEnabled?: boolean;
}) {
  const ratingLabel = game === 'omok' ? '오목 RP' : 'RP';
  return <div className="arena-player-summary arena-player-summary--shared" aria-label="내 공통 프로필">
    {cosmeticsEnabled ? <LobbyCosmeticAvatar/>
      : <span className="arena-avatar" aria-hidden="true">●</span>}
    <div className="arena-player-summary-copy">
      <p className="arena-nickname">{nickname}</p>
      <p className="arena-muted">{rating === null
        ? ratingLabel + '를 불러오지 못했어요'
        : rating.toLocaleString('ko-KR') + ' ' + ratingLabel}</p>
      {experienceEnabled && <LobbyExperienceMini/>}
    </div>
  </div>;
}
