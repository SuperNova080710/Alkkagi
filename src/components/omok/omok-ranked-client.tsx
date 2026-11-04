'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArenaPanel } from '@/components/ui/arena';
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
// Queue and leaderboard are separate services. A slow or failed leaderboard
// must never prevent an already matched player from entering their game.
type RankedLobbyHandlers = {
  isActive: () => boolean;
  applyQueue: (queue: QueueState) => void;
  applyDashboard: (dashboard: RankedDashboard) => void;
  reportQueueError: (message: string) => void;
  reportDashboardError: (message: string) => void;
};

export async function refreshRankedLobbyData(
  handlers: RankedLobbyHandlers,
  request: (url: string) => Promise<unknown> = omokRequest,
): Promise<void> {
  const queueJob = Promise.resolve()
    .then(() => request('/api/omok/ranked/queue'))
    .then(parseQueueState)
    .then(value => {
      if (!handlers.isActive()) return;
      handlers.applyQueue(value);
      handlers.reportQueueError('');
    })
    .catch(cause => {
      if (handlers.isActive()) handlers.reportQueueError(omokErrorText(cause));
    });
  const leaderboardJob = Promise.resolve()
    .then(() => request('/api/omok/ranked/dashboard'))
    .then(parseRankedDashboard)
    .then(value => {
      if (!handlers.isActive()) return;
      handlers.applyDashboard(value);
      handlers.reportDashboardError('');
    })
    .catch(cause => {
      if (handlers.isActive()) handlers.reportDashboardError(omokErrorText(cause));
    });
  await Promise.all([queueJob, leaderboardJob]);
}

export function OmokRankedLobby({ nickname = '닉네임 확인 필요' }: { nickname?: string } = {}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueState>({ status: 'idle', matchId: null });
  const [dashboard, setDashboard] = useState<RankedDashboard | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
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
      await refreshRankedLobbyData({
        isActive: () => alive.current,
        applyQueue,
        applyDashboard: setDashboard,
        reportQueueError: setError,
        reportDashboardError: setDashboardError,
      });
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

  const matchingStatus = queue.status === 'queued' ? '상대 검색 중'
    : queue.status === 'matched' ? '매칭 완료' : '대기 안 함';

  return <div className="arena-omok-ranked-view" aria-label="오목 랭킹">
    <header className="arena-service-heading">
      <div>
        <p className="arena-section-kicker">OMOK · RANKED ARENA</p>
        <h1>한 판씩, 더 높은 곳으로.</h1>
        <p>오목 랭크 RP는 알까기 RP와 별개로 정산됩니다.<br/>
          일반전과 AI 대전은 순위에 영향을 주지 않습니다.</p>
      </div>
      <Image src="/art/ranked.webp" alt="" width={150} height={150}/>
    </header>
    <div className="arena-service-name">
      <strong>{nickname}</strong>
      <Link href="/profile">내 프로필 <span aria-hidden="true">›</span></Link>
    </div>
    {dashboardError && <p className="arena-service-alert" role="alert">
      랭킹 정보를 불러오지 못했습니다. {dashboardError}
    </p>}
    <div className="arena-stats">
      <ArenaPanel title="나의 오목 RP">
        <p>{dashboard ? dashboard.rating.toLocaleString('ko-KR') : '—'}<small> RP</small></p>
      </ArenaPanel>
      <ArenaPanel title="매칭 상태">
        <p role="status" aria-live="polite">{matchingStatus}</p>
      </ArenaPanel>
      <ArenaPanel title="랭크 제한"><p>90초<small> / 턴</small></p></ArenaPanel>
    </div>
    <div className="arena-ranked-main">
      <div className="arena-service-controls">
        <section className="arena-omok-ranked-queue" aria-labelledby="omok-ranked-queue-title">
          <h2 id="omok-ranked-queue-title">랜덤 랭크 매칭</h2>
          {loading && <p role="status">오목 랭크 정보를 조회하는 중…</p>}
          <p className="arena-muted" role="status">
            {queue.status === 'queued'
              ? '비슷한 RP의 상대를 찾고 있습니다.'
              : queue.status === 'matched'
                ? '대전 상대를 찾았습니다. 경기로 이동합니다.'
                : '랭크 매칭을 시작하면 오목 RP가 비슷한 상대와 대전합니다.'}
          </p>
          {error && <p role="alert" className="arena-service-alert">{error}</p>}
          <div className="arena-omok-ranked-actions">
            {queue.status !== 'queued' && <button type="button" className="arena-button arena-button--gold"
              disabled={pending || queue.status === 'matched'} onClick={() => void change('join')}>
              {pending ? '처리 중…' : '랭크 매칭 시작'}
            </button>}
            {queue.status === 'queued' && <button type="button" className="arena-button arena-button--outline"
              disabled={pending} onClick={() => void change('cancel')}>
              {pending ? '취소 중…' : '매칭 취소'}
            </button>}
            <button type="button" className="arena-button arena-button--outline"
              disabled={pending} onClick={() => void refresh()}>최신 상태 조회</button>
          </div>
          <p className="arena-muted">45초 동안 대기 상태가 갱신되지 않으면 매칭이 만료될 수 있습니다.
            취소해도 RP는 변경되지 않습니다.</p>
        </section>
      </div>
      <div className="arena-ranking-grid">
        <ArenaPanel title="리더보드 TOP 100">
          <div className="arena-table-scroll arena-omok-ranked-table-scroll">
            <table className="arena-omok-ranked-table">
              <caption className="sr-only">오목 랭크 순위, 플레이어별 오목 RP 및 승패 기록</caption>
              <thead><tr><th scope="col">순위</th><th scope="col">닉네임</th>
                <th scope="col">오목 RP</th><th scope="col">승</th>
                <th scope="col">패</th><th scope="col">무</th></tr></thead>
              <tbody>{dashboard?.leaderboard.map(person => <tr key={person.position}>
                <td><span className="arena-rank-number">{person.position}</span></td>
                <td>{person.nickname}</td><td>{person.rating.toLocaleString('ko-KR')}</td>
                <td>{person.wins}</td><td>{person.losses}</td><td>{person.draws}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {!loading && !dashboardError && dashboard?.leaderboard.length === 0 &&
            <p className="arena-muted">아직 오목 랭크 순위가 없습니다.</p>}
        </ArenaPanel>
        <ArenaPanel title="오목 랭크 안내">
          <ul className="arena-history arena-omok-ranked-guide">
            <li><strong>오목 전용 RP</strong><p>알까기와 독립적으로 계산합니다.</p></li>
            <li><strong>턴당 90초</strong><p>제한 시간 안에 착수해 주세요.</p></li>
            <li><strong>일반전·AI와 분리</strong><p>일반전과 AI 대전은 오목 랭크 RP를 변경하지 않습니다.</p></li>
          </ul>
        </ArenaPanel>
      </div>
    </div>
  </div>;
}
