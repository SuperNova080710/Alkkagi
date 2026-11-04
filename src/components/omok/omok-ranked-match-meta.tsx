'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { omokRequest } from './omok-client-api';
import './omok-competitive.css';

type Rating = { before_rating: number; after_rating: number; delta: number };
type Clock = { status: string; turn_deadline: string | null };
export function OmokRankedMatchMeta({ matchId, currentUserId }: {
  matchId: string; currentUserId: string;
}) {
  const [clock, setClock] = useState<Clock | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const lastExpire = useRef(0);
  const expireBusy = useRef(false);

  const refresh = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      if (alive.current) setError('랭크 결과 조회 연결이 준비되지 않았습니다.');
      return;
    }
    try {
      // The DB grants each authenticated player only their own rating history.
      // The match is also RLS-filtered to participants.
      const db = createBrowserClient(url, key);
      const [game, history] = await Promise.all([
        db.from('omok_matches').select('status,turn_deadline')
          .eq('id', matchId).maybeSingle(),
        db.from('omok_rating_history').select('before_rating,after_rating,delta')
          .eq('match_id',matchId).eq('user_id',currentUserId).maybeSingle(),
      ]);
      if (!alive.current) return;
      if (game.error || history.error || !game.data) {
        setError('턴 제한 또는 RP 기록을 확인하지 못했습니다.');
        return;
      }
      setError('');
      setClock({
        status: game.data.status,
        turn_deadline: typeof game.data.turn_deadline === 'string'
          ? game.data.turn_deadline : null,
      });
      if (history.data && typeof history.data.delta === 'number')
        setRating(history.data as Rating);
    } catch {
      if (alive.current) setError('오목 랭크 기록을 확인하지 못했습니다.');
    }
  }, [matchId, currentUserId]);

  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => { if (alive.current) { setNow(Date.now()); void refresh(); } });
    const second = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 5000);
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      window.clearInterval(second); window.clearInterval(poll);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);

  const deadline = clock?.turn_deadline ? Date.parse(clock.turn_deadline) : NaN;
  const remaining = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  useEffect(() => {
    if (remaining !== 0 || clock?.status !== 'active' || expireBusy.current ||
      now - lastExpire.current < 12000) return;
    lastExpire.current = now;
    expireBusy.current = true;
    // Expiry is server authoritative. Client time is only a cue to request it.
    queueMicrotask(() => {
      void omokRequest('/api/omok/ranked/matches/' + matchId + '/expire', { method: 'POST' })
        .catch(() => { /* server can reject early/duplicate expiry; a refresh reconciles */ })
        .finally(() => {
          expireBusy.current = false;
          window.dispatchEvent(new Event('omok:refresh'));
          void refresh();
        });
    });
  }, [remaining, clock?.status, now, matchId, refresh]);

  return <section className="arena-omok-live-panel arena-omok-ranked-meta" aria-label="오목 랭크 시간·정산">
    <div><strong>{clock?.status === 'finished' ? '대국 종료' :
      remaining === null ? '90초 턴 제한 · 상태 확인 중' :
      '남은 턴 시간 ' + remaining + '초'}</strong>
      <p className="arena-omok-panel-hint">서버 시각과 다를 수 있으며, 시간 초과 여부는 서버가 확정합니다.</p>
    </div>
    <div><strong>{rating
      ? (rating.delta > 0 ? '+' : '') + rating.delta + ' 오목 RP'
      : '오목 RP 정산 확인 중'}</strong>
      {rating && <p className="arena-omok-panel-hint">
        {rating.before_rating.toLocaleString()} → {rating.after_rating.toLocaleString()} RP
      </p>}
    </div>
    <button type="button" className="arena-button arena-button--outline"
      onClick={() => void refresh()}>랭크 상태 갱신</button>
    {error && <p role="alert" className="arena-omok-live-error">{error}</p>}
  </section>;
}
