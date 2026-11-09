'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RankedQueuePanel } from '@/components/ranked/ranked-queue-panel';
import { chessRequest, useChessSnapshot } from './client';

type Queue = {status:'idle'|'queued'|'matched';matchId:string|null};

export function ChessRankedQueue({userId}: {userId:string}) {
  const router = useRouter();
  const {data,error,refresh,accept} = useChessSnapshot<Queue>('/ranked',userId,'ranked');
  const [pending,setPending] = useState(false);
  const [notice,setNotice] = useState('');
  const lock = useRef(false);
  const change = useCallback(async (action: 'join' | 'cancel', heartbeat = false) => {
    if (lock.current) return;
    lock.current = true;
    if (!heartbeat) {setPending(true); setNotice('');}
    try {accept(await chessRequest<Queue>('/ranked',{action}));}
    catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '매칭 상태를 확인하지 못했습니다.');
    } finally {lock.current = false; if (!heartbeat) setPending(false);}
  },[accept]);
  useEffect(() => {
    if (data?.matchId) router.replace('/chess/matches/' + data.matchId);
  },[data?.matchId,router]);
  useEffect(() => {
    if (data?.status !== 'queued') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void change('join',true);
    },15000);
    return () => window.clearInterval(timer);
  },[data?.status,change]);
  return <>
    <RankedQueuePanel status={data?.status ?? 'idle'} pending={pending} loading={!data && !error}
      error={notice || error} onChange={action => void change(action)} onRefresh={() => void refresh()}/>
    <p className="arena-muted">턴당 90초 · 체스 전용 RP</p>
  </>;
}

export function ChessTurnClock({deadline,onExpire}: {deadline:string;onExpire:()=>Promise<void>}) {
  const [seconds,setSeconds] = useState(() => Math.max(0, Math.ceil((Date.parse(deadline)-Date.now())/1000)));
  useEffect(() => {
    let running = false;
    let retryAt = 0;
    function tick() {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((Date.parse(deadline)-now)/1000));
      setSeconds(remaining);
      if (!remaining && !running && now>=retryAt) {
        running = true;
        retryAt = now + 4000;
        void onExpire().finally(() => {running = false;});
      }
    }
    const interval = window.setInterval(tick,500);
    return () => window.clearInterval(interval);
  },[deadline,onExpire]);
  return <p>남은 턴 시간 <strong>{seconds}초</strong></p>;
}
