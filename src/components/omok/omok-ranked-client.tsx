'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isRecord, isUuid, omokErrorText, omokRequest } from './omok-client-api';
import './omok-competitive.css';

type QueueState = { status: 'idle' | 'queued' | 'matched'; matchId: string | null };
type RankedEntry = {
  position: number; nickname: string; rating: number;
  wins: number; losses: number; draws: number;
};
export type RankedDashboard = { rating: number; leaderboard: RankedEntry[] };

export function parseQueueState(data: unknown): QueueState {
  if (!isRecord(data) || !['idle','queued','matched'].includes(String(data.status)))
    throw Error('OMOK_QUEUE_RESPONSE_INVALID');
  if (data.status === 'matched' && !isUuid(data.matchId)) throw Error('OMOK_QUEUE_RESPONSE_INVALID');
  return { status: data.status as QueueState['status'],
    matchId: isUuid(data.matchId) ? data.matchId : null };
}
export function parseRankedDashboard(data: unknown): RankedDashboard {
  if (!isRecord(data) || typeof data.rating !== 'number' ||
    !Number.isFinite(data.rating) || !Array.isArray(data.leaderboard))
    throw Error('OMOK_RANK_RESPONSE_INVALID');
  const rows = data.leaderboard.filter(isRecord).filter(row =>
    typeof row.nickname === 'string' &&
    [row.position,row.rating,row.wins,row.losses,row.draws]
      .every(value => typeof value === 'number' && Number.isFinite(value)));
  return { rating: data.rating, leaderboard: rows.map(row => ({
    position: row.position as number, nickname: row.nickname as string,
    rating: row.rating as number, wins: row.wins as number,
    losses: row.losses as number, draws: row.draws as number,
  })) };
}
export function OmokRankedLobby() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueState>({ status: 'idle', matchId: null });
  const [dashboard, setDashboard] = useState<RankedDashboard | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queued = useRef(false);
  const busy = useRef(false);
  const alive = useRef(true);

  const applyQueue = useCallback((value: QueueState) => {
    setQueue(value);
    queued.current = value.status === 'queued';
    if (value.status === 'matched' && value.matchId)
      router.replace('/omok/ranked/matches/' + value.matchId);
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      const [queueData, dashData] = await Promise.all([
        omokRequest<unknown>('/api/omok/ranked/queue'),
        omokRequest<unknown>('/api/omok/ranked/dashboard'),
      ]);
      if (!alive.current) return;
      applyQueue(parseQueueState(queueData));
      setDashboard(parseRankedDashboard(dashData));
      setError('');
    } catch (cause) {
      if (alive.current) setError(omokErrorText(cause));
    } finally { if (alive.current) setLoading(false); }
  }, [applyQueue]);

  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => { if (alive.current) void refresh(); });
    const ticker = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 7000);
    const heartbeat = window.setInterval(() => {
      // The SQL queue expires after 45 seconds without a heartbeat.
      if (document.visibilityState !== 'visible' || !queued.current || busy.current) return;
      busy.current = true;
      void omokRequest<unknown>('/api/omok/ranked/queue', {
        method: 'POST', body: { intent: 'join' },
      }).then(response => {
        if (alive.current && queued.current) applyQueue(parseQueueState(response));
      }).catch(cause => {
        if (alive.current) setError(omokErrorText(cause));
      }).finally(() => { busy.current = false; });
    }, 18000);
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      window.clearInterval(ticker);
      window.clearInterval(heartbeat);
      window.removeEventListener('focus', focus);
    };
  }, [refresh, applyQueue]);

  async function change(intent: 'join' | 'cancel') {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    if (intent === 'cancel') queued.current = false;
    try {
      const value = await omokRequest<unknown>('/api/omok/ranked/queue', {
        method: 'POST', body: { intent },
      });
      applyQueue(parseQueueState(value));
      if (intent === 'cancel') await refresh();
    } catch (cause) {
      setError(omokErrorText(cause));
      await refresh();
    } finally { busy.current = false; setPending(false); }
  }

  return <section className="arena-omok-live-panel arena-omok-live-stack" aria-label="오목 랭크 대전">
    <header className="arena-omok-live-heading"><div>
      <p className="arena-section-kicker">OMOK · RANKED</p>
      <h1>오목 랭크전</h1>
      <p>오목 RP는 기존 알까기 RP와 별도로 정산됩니다.</p>
    </div><Link href="/omok" className="arena-button arena-button--outline">오목 로비</Link></header>
    {loading && <p role="status">오목 랭크 정보를 조회하는 중…</p>}
    <div className="arena-omok-ranked-summary">
      <div><small>나의 오목 RP</small><strong>{dashboard ? dashboard.rating.toLocaleString() + ' RP' : '확인 중'}</strong></div>
      <div><small>매칭 상태</small><strong role="status" aria-live="polite">
        {queue.status === 'queued' ? '상대 검색 중' : queue.status === 'matched' ? '매칭 완료' : '대기 안 함'}
      </strong></div>
      <div><small>랭크 제한</small><strong>턴당 90초</strong></div>
    </div>
    {error && <p className="arena-omok-live-error" role="alert">{error}</p>}
    <div className="arena-omok-panel-actions">
      {queue.status !== 'queued' && <button type="button" className="arena-button"
        disabled={pending || queue.status === 'matched'} onClick={() => void change('join')}>
        {pending ? '처리 중…' : '랭크 매칭 시작'}
      </button>}
      {queue.status === 'queued' && <button type="button" className="arena-button arena-button--outline"
        disabled={pending} onClick={() => void change('cancel')}>
        {pending ? '취소 중…' : '매칭 취소'}
      </button>}
      <button type="button" className="arena-button arena-button--outline" disabled={pending}
        onClick={() => void refresh()}>최신 상태 조회</button>
    </div>
    {queue.status === 'queued' && <p className="arena-omok-panel-hint">
      상대를 찾는 중입니다. 대기 중에는 매칭 상태를 자동으로 확인합니다.
      페이지를 오래 벗어나면 서버에서 대기가 만료될 수 있습니다.
    </p>}
    <section aria-labelledby="omok-ranked-board-title">
      <h2 id="omok-ranked-board-title">오목 랭킹 TOP {dashboard?.leaderboard.length ?? 0}</h2>
      <div className="arena-omok-ranked-table-scroll">
        <table className="arena-omok-ranked-table">
          <thead><tr><th scope="col">순위</th><th scope="col">플레이어</th><th scope="col">오목 RP</th>
            <th scope="col">승</th><th scope="col">패</th><th scope="col">무</th></tr></thead>
          <tbody>{dashboard?.leaderboard.map(person => <tr key={person.position}>
            <td>{person.position}</td><td>{person.nickname}</td><td>{person.rating.toLocaleString()}</td>
            <td>{person.wins}</td><td>{person.losses}</td><td>{person.draws}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!loading && dashboard?.leaderboard.length === 0 &&
        <p className="arena-omok-panel-hint">아직 오목 랭킹 기록이 없습니다.</p>}
    </section>
  </section>;
}
