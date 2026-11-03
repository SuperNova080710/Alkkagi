'use client';

import { useEffect, useState } from 'react';
import { cosmeticRequest, isCosmeticInventory, safeCosmeticCode } from '@/components/cosmetics/cosmetic-api';

/** Presentation only. Never used to construct shot, physics, RP or match payloads. */
export type MatchCosmeticLook = { pieceCode: string; avatarCode: string };
export type MatchCosmeticLooks = Record<string, MatchCosmeticLook>;

export const DEFAULT_MATCH_LOOK: MatchCosmeticLook = {
  pieceCode: 'piece-classic', avatarCode: 'avatar-classic',
};

export function safeMatchCosmeticLook(value: unknown): MatchCosmeticLook {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_MATCH_LOOK;
  const data = value as Record<string, unknown>;
  return {
    pieceCode: safeCosmeticCode(typeof data.pieceCode === 'string' ? data.pieceCode : '', 'piece'),
    avatarCode: safeCosmeticCode(typeof data.avatarCode === 'string' ? data.avatarCode : '', 'avatar'),
  };
}

export async function fetchMatchCosmeticLooks(
  viewerId: string, opponentId: string | null, signal?: AbortSignal,
): Promise<MatchCosmeticLooks> {
  const result: MatchCosmeticLooks = {
    [viewerId]: DEFAULT_MATCH_LOOK,
    ...(opponentId && opponentId !== viewerId ? { [opponentId]: DEFAULT_MATCH_LOOK } : {}),
  };
  // Individual failures (404/private, 503/migrations pending, network) never block the match.
  const requests: Promise<void>[] = [
    cosmeticRequest<unknown>('/api/cosmetics/me', { signal })
      .then(value => {
        if (isCosmeticInventory(value)) result[viewerId] = safeMatchCosmeticLook(value.loadout);
      }).catch(() => {}),
  ];
  if (opponentId && opponentId !== viewerId) {
    requests.push(cosmeticRequest<unknown>(
      '/api/cosmetics/players/' + encodeURIComponent(opponentId), { signal },
    ).then(value => {
      result[opponentId] = safeMatchCosmeticLook(value);
    }).catch(() => {}));
  }
  await Promise.all(requests);
  return result;
}

/** Fetch once per viewer/opponent pairing; animation frames only change Board, not cosmetics. */
export function useMatchCosmetics(
  viewerId: string, opponentId: string | null, enabled: boolean,
): MatchCosmeticLooks {
  const key = enabled ? viewerId + ':' + (opponentId ?? '') : '';
  const [response, setResponse] = useState<{ key: string; looks: MatchCosmeticLooks } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetchMatchCosmeticLooks(viewerId, opponentId, controller.signal).then(looks => {
      if (!controller.signal.aborted) setResponse({ key, looks });
    });
    return () => controller.abort();
  }, [viewerId, opponentId, enabled, key]);
  return response?.key === key && enabled ? response.looks : {};
}
