'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArenaPanel } from '@/components/ui/arena-panel';
import type { ChessMove } from '@/lib/chess/engine';
import { ChessBoard } from './chess-board';
import { chessRequest, useChessSnapshot, type ChessSnapshot } from './client';

type Room = {id: string; code: string; hostId: string; guestId: string | null; status: string; matchId: string | null};
const reasonText: Record<string, string> = {
  checkmate: '체크메이트', resignation: '기권', stalemate: '스테일메이트',
  'insufficient-material': '기물 부족', 'threefold-repetition': '3회 반복', 'fifty-move-rule': '50수 규칙',
  timeout: '시간 초과',
};

export function ChessRoomEntry() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const creation = useRef<string | null>(null);
  async function submit(action: 'create' | 'join') {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      const body = action === 'create'
        ? {action, requestId: creation.current ??= crypto.randomUUID()}
        : {action, code};
      const {roomId} = await chessRequest<{roomId:string}>('/rooms', body);
      creation.current = null;
      router.push('/chess/rooms/' + roomId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '방에 연결하지 못했습니다.'); }
    finally {lock.current = false; setPending(false);}
  }
  function join(event: FormEvent) { event.preventDefault(); void submit('join'); }
  return <div className="chess-join">
    <button type="button" className="arena-button arena-button--gold" disabled={pending} onClick={() => void submit('create')}>방 만들기</button>
    <form onSubmit={join} className="chess-join">
      <input aria-label="체스 초대 코드" placeholder="초대 코드 8자리" autoComplete="off"
        maxLength={12} value={code} onChange={event => setCode(event.target.value)} required/>
      <button className="arena-button arena-button--outline" disabled={pending}>코드로 참가</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function ChessRoomClient({roomId,userId}: {roomId: string; userId: string}) {
  const router = useRouter();
  const path = '/rooms/' + roomId;
  const {data: room, error, refresh} = useChessSnapshot<Room>(path, roomId, 'room');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => { if (room?.matchId) router.replace('/chess/matches/' + room.matchId); }, [room?.matchId,router]);

  async function command(action: 'start' | 'leave') {
    if (pending) return;
    setPending(true); setNotice('');
    try {
      const data = await chessRequest<{matchId?:string}>(path,{action});
      router.replace(data.matchId ? '/chess/matches/' + data.matchId : '/chess');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.');
      await refresh();
    } finally { setPending(false); }
  }
  return <ArenaPanel title="체스 일반전 대기실">
    {!room && !error && <p role="status">대기실을 불러오는 중입니다.</p>}
    {(error || notice) && <p role="alert">{notice || error}</p>}
    {room && <>
      <p>초대 코드 <strong>{room.code}</strong></p>
      <p role="status">{room.status === 'closed' ? '닫힌 대기실입니다.' : room.guestId ? '두 명이 입장했습니다.' : '상대가 코드로 입장하기를 기다리고 있습니다.'}</p>
      {room.status === 'waiting' && <div className="chess-actions">
        {room.hostId === userId && <button type="button" className="arena-button arena-button--gold"
          disabled={pending || !room.guestId} onClick={() => void command('start')}>대국 시작</button>}
        <button type="button" className="arena-button arena-button--outline" disabled={pending}
          onClick={() => void command('leave')}>{room.hostId === userId ? '방 닫기' : '나가기'}</button>
      </div>}
    </>}
    <Link className="arena-text-link" href="/chess">체스 로비</Link>
  </ArenaPanel>;
}

export function ChessMatchClient({matchId,userId}: {matchId: string; userId: string}) {
  const path = '/matches/' + matchId;
  const {data: match, error, refresh, accept} = useChessSnapshot<ChessSnapshot>(path, matchId, 'match');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [resigning, setResigning] = useState(false);
  const lock = useRef(false);
  const retry = useRef<{signature:string; requestId:string} | null>(null);

  async function command(action: 'move' | 'resign', move?: ChessMove) {
    if (!match || lock.current) return;
    lock.current = true; setPending(true); setNotice('');
    const body = {action, ...(move ? {ply:match.ply, ...move} : {})};
    const signature = JSON.stringify(body);
    if (retry.current?.signature !== signature) retry.current = {signature, requestId:crypto.randomUUID()};
    try {
      accept(await chessRequest<ChessSnapshot>(path, {...body,requestId:retry.current.requestId}));
      retry.current = null;
      setResigning(false);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '연결을 확인해 주세요.');
      await refresh();
    } finally {lock.current = false; setPending(false);}
  }

  if (!match) return <ArenaPanel title="체스 대국">
    {error ? <p role="alert">{error}</p> : <p role="status">대국을 불러오는 중입니다.</p>}
    <Link href="/chess" className="arena-text-link">체스 로비</Link>
  </ArenaPanel>;
  const finished = match.status === 'finished';
  const myTurn = !finished && match.turnUserId === userId;
  return <div className="chess-game-layout">
    <ChessBoard key={match.ply} fen={match.fen} black={match.blackId === userId}
      enabled={myTurn && !pending && !error && !resigning} onMove={move => void command('move',move)}/>
    <ArenaPanel title={match.mode === 'ranked' ? '체스 랭크전' : '체스 일반전'}>
      <p role="status">{finished
        ? `${!match.winnerId ? '무승부' : match.winnerId === userId ? '승리' : '패배'} · ${reasonText[match.finishReason ?? ''] ?? '대국 종료'}`
        : `${myTurn ? '내 차례' : '상대 차례'}${match.inCheck ? ' · 체크' : ''}`}</p>
      <p>내 기물 {match.whiteId === userId ? '백' : '흑'}</p>
      {(notice || error) && <p role="alert">{notice || error}</p>}
      <h3>기보</h3>
      <ol className="chess-history">{match.moves.map(move => <li key={move.ply}>{move.san}</li>)}</ol>
      <div className="chess-actions">
        {!finished && !resigning && <button type="button" className="arena-button arena-button--outline"
          disabled={pending} onClick={() => setResigning(true)}>기권</button>}
        {!finished && resigning && <>
          <button type="button" className="arena-button" disabled={pending} onClick={() => void command('resign')}>기권 확정</button>
          <button type="button" className="arena-button arena-button--outline" disabled={pending} onClick={() => setResigning(false)}>취소</button>
        </>}
        <Link href={match.mode === 'ranked' ? '/chess/ranked' : '/chess'} className="arena-button arena-button--outline">로비</Link>
      </div>
    </ArenaPanel>
  </div>;
}
