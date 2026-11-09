'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyInvite } from '@/components/rooms/copy-invite';
import { SendFriendRoomInvite } from '@/components/rooms/send-friend-room-invite';
import { ArenaPanel } from '@/components/ui/arena-panel';
import type { ChessMove } from '@/lib/chess/engine';
import { ChessTurnClock } from './chess-ranked';
import { ChessBoard } from './chess-board';
import { ChessTurnStatus } from './chess-turn-status';
import { chessRequest, useChessSnapshot, type ChessSnapshot } from './client';

type Room = {id: string; code: string; hostId: string; guestId: string | null; status: string; matchId: string | null};
const reasonText: Record<string, string> = {
  checkmate: '체크메이트', resignation: '기권', stalemate: '스테일메이트',
  'insufficient-material': '기물 부족', 'threefold-repetition': '3회 반복', 'fifty-move-rule': '50수 규칙',
  timeout: '시간 초과',
};

export function ChessRoomClient({roomId, userId, invitesEnabled}: {
  roomId: string; userId: string; invitesEnabled: boolean;
}) {
  const router = useRouter();
  const path = '/rooms/' + roomId;
  const {data: room, error, refresh} = useChessSnapshot<Room>(path, roomId, 'room');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (room?.matchId) router.replace('/chess/matches/' + room.matchId); }, [room?.matchId,router]);

  async function command(action: 'start' | 'leave') {
    if (lock.current) return;
    lock.current = true;
    setPending(true); setNotice('');
    try {
      const data = await chessRequest<{matchId?:string}>(path,{action});
      router.replace(data.matchId ? '/chess/matches/' + data.matchId : '/chess');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.');
      await refresh();
    } finally { lock.current = false; setPending(false); }
  }
  if (!room) return <ArenaPanel title="체스 일반전 대기실">
    {error ? <><p role="alert">{error}</p>
      <button type="button" className="arena-button" onClick={() => void refresh()}>다시 조회</button></>
      : <p role="status">대기실을 불러오는 중입니다.</p>}
  </ArenaPanel>;

  const host = room.hostId === userId;
  const waiting = room.status === 'waiting';
  return <>
    <header className="game-page-header arena-room-heading">
      <div><p className="arena-section-kicker">CASUAL MATCH · CHESS ARENA</p>
        <h1>친구와 한 판</h1>
        <p className="arena-room-lead">친구를 초대해 체스 대국을 시작하세요.</p>
      </div>
      <CopyInvite code={room.code}/>
    </header>
    <div className="arena-room-wait-layout">
      <section className="arena-panel arena-room-stage" aria-labelledby="chess-room-stage-title">
        <div className="arena-room-stage-head">
          <h2 id="chess-room-stage-title">참가자 <span>{room.guestId ? 2 : 1}/2</span></h2>
          <span className="arena-room-status">{waiting ? room.guestId ? '시작 준비 완료' : '대기 중' : '대기실 종료'}</span>
        </div>
        <ol className="arena-room-seats" aria-label="참가자">
          {[room.hostId, room.guestId].map((id, index) =>
            <li key={index} className={id === userId ? 'is-mine' : ''}>
              <span className="arena-room-seat-number" aria-hidden="true">0{index + 1}</span>
              <div>
                <span className="arena-room-seat-role">{index === 0 ? '선공 · 백' : '후공 · 흑'}</span>
                <strong>{id ? index === 0 ? '방장' : '참가자' : '친구 기다리는 중'}</strong>
                {id === userId && <span className="arena-room-self">나</span>}
              </div>
            </li>)}
        </ol>
        <p className="arena-room-wait-note" role="status">{!waiting ? '대기실이 닫혔거나 대국이 시작되었습니다.'
          : room.guestId ? host ? '두 명이 모였습니다. 경기를 시작할 수 있습니다.' : '방장의 경기 시작을 기다리고 있습니다.'
            : '두 명이 입장하면 경기를 시작할 수 있습니다.'}</p>
        {(error || notice) && <p className="arena-invite-error" role="alert">{notice || error}</p>}
        {waiting && host && <div className="arena-room-main-action">
          <button type="button" className="arena-button arena-button--gold" disabled={pending || !room.guestId}
            onClick={() => void command('start')}>경기 시작</button>
        </div>}
        {waiting && <div className="arena-room-leave">
          <button type="button" className="arena-button arena-button--outline" disabled={pending}
            onClick={() => void command('leave')}>{host ? '방 닫기' : '방 나가기'}</button>
        </div>}
      </section>
      {invitesEnabled && waiting && host && !room.guestId &&
        <aside className="arena-room-side" aria-label="상대 추가">
          <SendFriendRoomInvite roomId={roomId} game="chess"/>
        </aside>}
    </div>
  </>;
}

export function ChessMatchClient({matchId,userId}: {matchId: string; userId: string}) {
  const path = '/matches/' + matchId;
  const {data: match, error, refresh, accept, reportError} = useChessSnapshot<ChessSnapshot>(path, matchId, 'match');
  const [pending, setPending] = useState(false);
  const [resigning, setResigning] = useState(false);
  const lock = useRef(false);
  const retry = useRef<{signature:string; requestId:string} | null>(null);

  async function command(action: 'move' | 'resign', move?: ChessMove) {
    if (!match || lock.current) return;
    lock.current = true; setPending(true);
    const body = {action, ...(move ? {ply:match.ply, ...move} : {})};
    const signature = JSON.stringify(body);
    if (retry.current?.signature !== signature) retry.current = {signature, requestId:crypto.randomUUID()};
    try {
      accept(await chessRequest<ChessSnapshot>(path, {...body,requestId:retry.current.requestId}));
      retry.current = null;
      setResigning(false);
    } catch (cause) {
      reportError(cause instanceof Error ? cause.message : '연결을 확인해 주세요.');
      await refresh();
    } finally {lock.current = false; setPending(false);}
  }

  const expire = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    try {accept(await chessRequest<ChessSnapshot>(path,{action:'expire'}));}
    catch {await refresh();}
    finally {lock.current = false;}
  },[path,accept,refresh]);

  if (!match) return <ArenaPanel title="체스 대국">
    {error ? <p role="alert">{error}</p> : <p role="status">대국을 불러오는 중입니다.</p>}
    <Link href="/chess" className="arena-text-link">체스 로비</Link>
  </ArenaPanel>;
  const finished = match.status === 'finished';
  const myTurn = !finished && match.turnUserId === userId;
  return <div className="chess-game-layout">
    <div className="chess-board-stage">
      <ChessTurnStatus black={match.blackId === userId} myTurn={myTurn} finished={finished}
        inCheck={match.inCheck} pending={pending} error={Boolean(error)} confirming={resigning}/>
      <ChessBoard key={match.id} fen={match.fen} black={match.blackId === userId}
        enabled={myTurn && !pending && !error && !resigning} onMove={move => void command('move',move)}/>
    </div>
    <ArenaPanel title={match.mode === 'ranked' ? '체스 랭크전' : '체스 일반전'}>
      {finished && <p role="status">
        {!match.winnerId ? '무승부' : match.winnerId === userId ? '승리' : '패배'} · {reasonText[match.finishReason ?? ''] ?? '대국 종료'}
      </p>}
      {!finished && match.deadline && <ChessTurnClock key={match.deadline} deadline={match.deadline} onExpire={expire}/>}
      <p>내 기물 {match.whiteId === userId ? '백' : '흑'}</p>
      {error && <p role="alert">{error}</p>}
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
