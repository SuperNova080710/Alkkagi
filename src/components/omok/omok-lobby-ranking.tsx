'use client';

import { useEffect, useState } from 'react';
import { omokRequest, isRecord } from './omok-client-api';

export function OmokLobbyRanking() {
  const [rating, setRating] = useState<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let active = true;
    void omokRequest<unknown>('/api/omok/ranked/dashboard')
      .then(value => {
        if (!active) return;
        if (isRecord(value) && typeof value.rating === 'number' &&
          Number.isFinite(value.rating)) {
          setRating(value.rating);
          setState('ready');
        } else {
          setState('unavailable');
        }
      })
      .catch(() => { if (active) setState('unavailable'); });
    return () => { active = false; };
  }, []);

  return <div className="arena-player-summary">
    <span className="arena-avatar" aria-hidden="true">●</span>
    <div className="arena-player-summary-copy">
      <p className="arena-nickname">내 오목 RP</p>
      <p className="arena-muted" role="status">
        {state === 'ready' && rating !== null ? rating.toLocaleString('ko-KR') + ' RP' :
          state === 'loading' ? '오목 RP 조회 중' : '현재 오목 RP 조회 불가'}
      </p>
    </div>
  </div>;
}
