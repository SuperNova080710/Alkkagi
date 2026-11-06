'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ChessSnapshot = {
  id: string; whiteId: string; blackId: string; turnUserId: string | null;
  status: 'active' | 'finished'; fen: string; inCheck: boolean; ply: number;
  winnerId: string | null; finishReason: string | null;
  moves: {ply: number; san: string}[];
  mode?: 'casual' | 'ranked';
  deadline?: string | null;
};

const labels: Record<string, string> = {
  AUTH_REQUIRED: '로그인 세션을 다시 확인해 주세요.',
  INVALID_CODE: '초대 코드 8자리를 확인해 주세요.',
  ROOM_NOT_FOUND: '입장할 수 있는 방을 찾지 못했습니다.',
  ROOM_CLOSED: '대기실이 닫혔습니다.',
  ROOM_FULL: '이미 두 명이 입장한 방입니다.',
  MATCH_NOT_FOUND: '대국 정보를 찾지 못했습니다.',
  NEED_TWO_PLAYERS: '두 명이 입장하면 시작할 수 있습니다.',
  INVALID_MOVE: '해당 칸으로 이동할 수 없습니다.',
  STALE_TURN: '대국이 갱신됐습니다. 최신 상태를 확인해 주세요.',
  NOT_YOUR_TURN: '상대 차례입니다.',
  MATCH_FINISHED: '이미 끝난 대국입니다.',
  REQUEST_CONFLICT: '다른 요청이 먼저 처리됐습니다.',
  ROOM_ACTIVE_LIMIT: '열린 대기실을 정리한 후 새 방을 만들어 주세요.',
  ROOM_RATE_LIMIT: '잠시 후 방 만들기를 다시 시도해 주세요.',
  CHESS_DISABLED: '체스 대전이 아직 열리지 않았습니다.',
  GAME_SERVICE_UNAVAILABLE: '체스 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
};
export async function chessRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/chess' + path, body
    ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}
    : {cache: 'no-store'});
  const result = await response.json();
  if (!response.ok) throw Error(labels[result.error] ?? '요청을 처리하지 못했습니다.');
  return result.data as T;
}

export function useChessSnapshot<T>(path: string, id: string, kind: 'room' | 'match' | 'ranked') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const accept = useCallback((value: T) => {
    sequence.current++;
    setData(value);
    setError('');
  }, []);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await chessRequest<T>(path);
      if (sequence.current === current) accept(next);
    } catch (cause) {
      if (sequence.current === current)
        setError(cause instanceof Error ? cause.message : '연결 상태를 확인해 주세요.');
    }
  }, [path, accept]);

  useEffect(() => {
    const load = () => { void refresh(); };
    queueMicrotask(load);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, kind === 'ranked' ? 2500 : 3500);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const db = kind !== 'ranked' && url && key ? createBrowserClient(url, key) : null;
    const channel = db?.channel('chess:' + kind + ':' + id).on('postgres_changes', {
      event: '*', schema: 'public', table: 'chess_matches',
      filter: (kind === 'room' ? 'room_id' : 'id') + '=eq.' + id,
    }, load);
    if (kind === 'room') channel?.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'chess_rooms', filter: 'id=eq.' + id,
    }, load);
    channel?.subscribe(status => { if (status === 'SUBSCRIBED') load(); });
    return () => {
      sequence.current++;
      window.clearInterval(poll);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
      if (db && channel) void db.removeChannel(channel);
    };
  }, [refresh, id, kind]);

  return {data, error, refresh, accept};
}
