'use client';

import { useActionState, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { HEIGHT, MAX_FORCE, MIN_FORCE, RADIUS, WIDTH, type Board } from '@/lib/game/engine';
import { viewportToBoard } from '@/lib/game/coordinates';
import { extractFrames, summarizeTurn, type TurnShot } from '@/lib/game/turn-history';
import { requestRematch } from '@/app/rooms/rematch';
import { GameFeedback } from '@/components/game/game-feedback';
import { keyboardVector, DIRECTIONS, type Direction } from '@/lib/game/keyboard-shot';
import { getPlayerIdentities } from '@/lib/game/player-identity';
import { GameIdentityHeading } from '@/components/game/game-identity-heading';

type Match = {
 id: string;
 status: string;
 turn_user_id: string;
 turn_no: number;
 player1_id: string;
 player2_id: string;
 winner_id: string | null;
 turn_deadline?: string | null;
 board_state: Board;
};
type Point = { x: number; y: number };
type Drag = { id: string; origin: Point; at: Point };
type Playback = { shotId: string; frames: Board[]; index: number };
type Player = { seat: number; nickname: string };
type Props = {
 match: Match;
 userId: string;
 roomId: string;
 players: Player[];
 rematchReadyCount: number;
 myRematchVote: boolean;
 shots: TurnShot[];
 mode?: 'casual' | 'ranked';
};

export function GameBoard({
 match, userId, roomId, players, rematchReadyCount, myRematchVote, shots, mode='casual',
}: Props) {
 const router = useRouter();
 const [drag, setDrag] = useState<Drag | null>(null);
 const [pending, setPending] = useState(false);
 const [error, setError] = useState('');
 const [remaining, setRemaining] = useState<number | null>(null);
 const [keyboardPiece,setKeyboardPiece] = useState('');
 const [keyboardDirection,setKeyboardDirection] = useState<Direction>('right');
 const [keyboardPower,setKeyboardPower] = useState(65);
 const [playback, setPlayback] = useState<Playback | null>(null);
 const [rematch, rematchAction, rematchPending] = useActionState(requestRematch, { error: '' });
 useEffect(() => {
  if(match.status!=='active'||!match.turn_deadline)return;
  const deadline=Date.parse(match.turn_deadline);
  if(!Number.isFinite(deadline))return;
  let stopped=false,lastAttempt=0;
  async function update(){
   if(stopped)return;
   const ms=Date.now();
   const seconds=Math.max(0,Math.ceil((deadline-ms)/1000));
   setRemaining(seconds);
   if(seconds===0&&ms-lastAttempt>5000){
    lastAttempt=ms;
    try{await fetch('/api/matches/'+match.id+'/expire',{method:'POST'});}catch{}
    if(!stopped)router.refresh();
   }
  }
  void update();
  const timer=window.setInterval(()=>{void update();},1000);
  return ()=>{stopped=true;window.clearInterval(timer);};
 },[match.id,match.status,match.turn_deadline,router]);
 const latestShot = shots.at(-1);
 const lastSeenShot = useRef<string | null>(latestShot?.id ?? null);
 const board = playback ? playback.frames[playback.index] : match.board_state;
 const animating = playback !== null;
 const myTurn = match.status === 'active' && match.turn_user_id === userId && !animating && remaining !== 0;
 const firstLabel = players.find(p => p.seat === 1)?.nickname ?? '선공';
 const secondLabel = players.find(p => p.seat === 2)?.nickname ?? '후공';
 const identities = getPlayerIdentities(match, userId, players, board);

 useEffect(() => {
  const timer = window.setInterval(() => router.refresh(), 3500);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return () => window.clearInterval(timer);
  const db = createBrowserClient(url, key);
  const channel = db.channel('match:' + match.id)
   .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'matches', filter: 'id=eq.' + match.id,
   }, () => router.refresh())
   .subscribe();
  return () => { window.clearInterval(timer); void db.removeChannel(channel); };
 }, [match.id, router]);

 useEffect(() => {
  if (!latestShot || lastSeenShot.current === latestShot.id) return;
  lastSeenShot.current = latestShot.id;
  const frames = extractFrames(latestShot);
  if (frames.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frame = window.requestAnimationFrame(() => {
   setPlayback({ shotId: latestShot.id, frames, index: 0 });
  });
  return () => window.cancelAnimationFrame(frame);
 }, [latestShot]);

 useEffect(() => {
  if (!playback) return;
  const timer = window.setInterval(() => setPlayback(current => {
   if (!current) return null;
   if (current.index >= current.frames.length - 1) return null;
   return { ...current, index: current.index + 1 };
  }), 24);
  return () => window.clearInterval(timer);
 }, [playback]);

 function location(event: PointerEvent<SVGSVGElement>): Point | null {
  return viewportToBoard(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
 }

 function down(event: PointerEvent<SVGSVGElement>) {
  if (!myTurn || pending) return;
  const position = location(event);
  if (!position || position.x < 0 || position.x > WIDTH || position.y < 0 || position.y > HEIGHT) return;
  const piece = board.pieces.find(p => p.owner === userId &&
   Math.hypot(p.x - position.x, p.y - position.y) < RADIUS + 8);
  if (!piece) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  setDrag({ id: piece.id, origin: { x: piece.x, y: piece.y }, at: position });
 }

 function move(event: PointerEvent<SVGSVGElement>) {
  if (!drag) return;
  const position = location(event);
  if (position) setDrag({ ...drag, at: position });
 }

 async function submitShot(pieceId:string,dx:number,dy:number){
  if(!myTurn||pending)return;
  setPending(true);
  setError('');
  try {
   const result=await fetch('/api/matches/'+match.id+'/shot',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pieceId,turnNo:match.turn_no,dx,dy,requestId:crypto.randomUUID()}),
   });
   if(!result.ok)throw Error(result.status===409?
    '이미 진행된 턴입니다. 게임 상태를 새로고칩니다.':'발사를 처리하지 못했습니다.');
   router.refresh();
  }catch(cause){
   setError(cause instanceof Error?cause.message:'연결 오류가 발생했습니다.');
   router.refresh();
  }finally{setPending(false);}
 }
 async function up(event:PointerEvent<SVGSVGElement>){
  if(!drag)return;
  const position=location(event),current=drag;
  setDrag(null);
  if(!position||!myTurn||pending)return;
  let dx=current.origin.x-position.x,dy=current.origin.y-position.y;
  const power=Math.hypot(dx,dy);
  if(power<MIN_FORCE)return;
  if(power>MAX_FORCE){dx*=MAX_FORCE/power;dy*=MAX_FORCE/power;}
  await submitShot(current.id,dx,dy);
 }
 async function keyboardFire(){
  const pieceId=board.pieces.find(p=>p.owner===userId&&p.id===keyboardPiece)?.id
   ??board.pieces.find(p=>p.owner===userId)?.id;
  if(!pieceId||!myTurn||pending)return;
  const vector=keyboardVector(keyboardDirection,keyboardPower);
  await submitShot(pieceId,vector.dx,vector.dy);
 }

 async function forfeit() {
  if (!window.confirm('정말 기권하시겠습니까?')) return;
  setPending(true);
  setError('');
  try {
   const result = await fetch('/api/matches/' + match.id + '/forfeit', { method: 'POST' });
   if (!result.ok) throw Error('기권을 처리하지 못했습니다.');
   router.refresh();
  } catch (cause) {
   setError(cause instanceof Error ? cause.message : '연결 오류가 발생했습니다.');
  } finally { setPending(false); }
 }

 const mine=board.pieces.filter(p=>p.owner===userId);
 const firstRemaining = board.pieces.filter(p => p.owner === match.player1_id).length;
 const secondRemaining = board.pieces.filter(p => p.owner === match.player2_id).length;
 const power = drag ? Math.min(MAX_FORCE, Math.hypot(drag.origin.x - drag.at.x, drag.origin.y - drag.at.y)) : 0;
 const turns = shots.map(s => summarizeTurn(s, match.player1_id, match.player2_id))
  .filter((item): item is NonNullable<typeof item> => item !== null);
 return <section className="game-screen mt-8">
  <GameIdentityHeading match={match} viewerId={userId} players={identities}
   mode={mode} animating={animating} pending={pending} remaining={remaining}/>
  <div className="game-screen-body">
   <div className="game-screen-main">
    <div className="game-screen-stage overflow-hidden rounded-3xl border-8 border-amber-900 bg-emerald-950 shadow-2xl">
     <svg viewBox="0 0 800 500" role="img"
      aria-label="알까기 보드. 자신의 알을 뒤로 드래그해 힘을 모아 발사합니다."
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      style={{ touchAction: 'none', width: '100%', display: 'block',
       cursor: myTurn && !pending ? 'crosshair' : 'default' }}>
      <rect x="0" y="0" width="800" height="500" fill="#064e3b"/>
      <rect x="23" y="23" width="754" height="454" fill="none"
       stroke="#34d399" strokeOpacity="0.18" strokeWidth="2"/>
      <path d="M400 20 V480" stroke="#34d399" strokeOpacity="0.15" strokeDasharray="8 10" strokeWidth="3"/>
      {identities.map(identity => {
       const x = identity.seat === 1 ? 29 : 583;
       return <g key={identity.id} aria-hidden="true" style={{ pointerEvents: 'none' }}>
        <rect x={x} y={24} width="188" height="34" rx="9" fill="#020617" fillOpacity="0.88"
         stroke={identity.color} strokeWidth={identity.isMe ? 2.6 : 1.4}/>
        <circle cx={x + 16} cy="41" r="6" fill={identity.color}/>
        <text x={x + 30} y="46" fontSize="13" fontWeight="800" fill="#f8fafc">
         {identity.isMe ? '내 알' : '상대 알'} · {identity.colorName}
        </text>
       </g>;
      })}
      {board.pieces.map(piece => <g key={piece.id}>
       <circle cx={piece.x + 2} cy={piece.y + 4} r={RADIUS + 1} fill="#000" opacity="0.28"/>
       <circle cx={piece.x} cy={piece.y} r={RADIUS}
        fill={piece.owner === match.player1_id ? '#f59e0b' : '#60a5fa'}
        stroke={piece.owner === userId ? '#fef3c7' : '#bfdbfe'} strokeWidth="2.5"/>
       <circle cx={piece.x - 5} cy={piece.y - 5} r="5" fill="#fff" opacity="0.45"/>
       {piece.owner === userId && <>
        <circle cx={piece.x} cy={piece.y} r={RADIUS + 5} fill="none"
         stroke="#ffffff" strokeWidth="2.6" strokeDasharray="4 3"/>
        <text x={piece.x} y={piece.y + 4} textAnchor="middle" fontSize="11" fontWeight="900"
         fill="#0f172a" style={{ pointerEvents:'none', userSelect:'none' }}>나</text>
       </>}
      </g>)}
      {drag && <g>
       <line x1={drag.origin.x} y1={drag.origin.y}
        x2={drag.origin.x + (drag.origin.x - drag.at.x)}
        y2={drag.origin.y + (drag.origin.y - drag.at.y)}
        stroke="#fef08a" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 5"/>
       <circle cx={drag.origin.x} cy={drag.origin.y} r={RADIUS + 5}
        stroke="#fef08a" fill="none" strokeWidth="2" strokeDasharray="4 4"/>
      </g>}
     </svg>
    </div>
    <div className="game-screen-bottom mt-3">
     <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 sm:text-sm">
      <p>{animating ? '이동 재생 중' : '턴 ' + match.turn_no} · 제한 세기 {MAX_FORCE}{match.status==='active' ? ' · 남은 시간 '+(remaining===null?'--:--':Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')) : ''}</p>
      {match.status === 'active' && <button type="button" onClick={forfeit}
       disabled={pending || animating}
       className="rounded-lg border border-rose-400 px-4 py-2 font-semibold text-rose-300 disabled:opacity-50">
       기권하기
      </button>}
     </div>
     <GameFeedback power={drag ? power : null} pending={pending} error={error}/>
    </div>
   </div>
   <aside className="game-turn-log rounded-2xl border border-slate-700 bg-slate-900/95 p-4"
    aria-label="턴 로그">
    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-3">
     <h3 className="font-bold">턴 기록</h3>
     <span className="text-xs tabular-nums text-slate-400">{turns.length}턴</span>
    </div>
    <p className="my-3 text-xs text-slate-400">각 턴에 탈락한 알을 기록합니다.</p>
    <ol className="game-turn-list space-y-2 pr-1" aria-label="진행된 턴">
     {turns.length === 0 && <li className="rounded-lg bg-slate-800/70 p-3 text-sm text-slate-400">
      첫 번째 발사를 기다리고 있습니다.
     </li>}
     {[...turns].reverse().map(turn => <li key={turn.id}
      className="rounded-lg border border-slate-700 bg-slate-800/75 p-3">
      <p className="text-xs font-bold text-emerald-300">TURN {turn.turnNo}</p>
      <p className="mt-1 truncate text-sm font-semibold">
       {turn.playerId === match.player1_id ? firstLabel : secondLabel} · {turn.pieceId} 발사
      </p>
      <p className="mt-1 break-words text-xs text-slate-300">
       {firstLabel} 알 {turn.firstLost}개 탈락
      </p>
      <p className="mt-1 break-words text-xs text-slate-300">
       {secondLabel} 알 {turn.secondLost}개 탈락
      </p>
     </li>)}
    </ol>
    {match.status==='active'&&<details className="mt-3 border-t border-slate-700 pt-3 text-sm">
     <summary className="cursor-pointer font-semibold text-emerald-300">키보드 조작</summary>
     <p className="mt-2 text-xs text-slate-400">알·방향·세기를 선택하고 발사하세요.</p>
     <label className="mt-3 block text-xs text-slate-300" htmlFor="keyboard-piece">발사할 알</label>
     <select id="keyboard-piece" value={mine.some(p=>p.id===keyboardPiece)?keyboardPiece:mine[0]?.id??''}
      onChange={event=>setKeyboardPiece(event.target.value)}
      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2">
      {mine.map(p=><option key={p.id} value={p.id}>{p.id}</option>)}
     </select>
     <label className="mt-3 block text-xs text-slate-300" htmlFor="keyboard-direction">방향</label>
     <select id="keyboard-direction" value={keyboardDirection}
      onChange={event=>setKeyboardDirection(event.target.value as Direction)}
      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2">
      {DIRECTIONS.map(direction=><option key={direction.value} value={direction.value}>{direction.label}</option>)}
     </select>
     <label className="mt-3 flex justify-between text-xs text-slate-300" htmlFor="keyboard-power">
      <span>세기</span><span>{keyboardPower}/{MAX_FORCE}</span>
     </label>
     <input id="keyboard-power" type="range" min={9} max={MAX_FORCE} step={1}
      value={keyboardPower} onChange={event=>setKeyboardPower(Number(event.target.value))}
      className="mt-2 w-full accent-emerald-300"/>
     <button type="button" onClick={keyboardFire} disabled={!myTurn||pending||mine.length===0}
      className="mt-3 w-full rounded-lg bg-emerald-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-50">
      선택한 알 발사
     </button>
    </details>}
    {match.status === 'finished' && <div className="mt-3 border-t border-slate-700 pt-3">
     <h4 className="font-bold text-emerald-300">경기 종료</h4>
     <p className="mt-1 text-sm text-slate-300">
      {match.winner_id === match.player1_id ? firstLabel + ' 승리' :
       match.winner_id === match.player2_id ? secondLabel + ' 승리' : '무승부'}
     </p>
     {mode === 'ranked' ? <Link href="/ranked" className="mt-4 block rounded-lg bg-emerald-300 px-4 py-3 text-center text-sm font-bold text-slate-950">랭크 로비로 돌아가기</Link> : <>
     <p className="mt-3 text-xs text-slate-300">
      재대전 준비 {rematchReadyCount}/2 · 두 명이 모두 수락하면 새 경기를 시작합니다.
     </p>
     <form action={rematchAction} className="mt-3">
      <input type="hidden" name="roomId" value={roomId}/>
      <button type="submit" disabled={myRematchVote || rematchPending || animating}
       className="w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">
       {myRematchVote ? '상대방 수락 대기 중' : rematchPending ? '요청 중…' : '다시하기 · 재대전 신청'}
      </button>
     </form>
     {rematch.error && <p role="alert" className="mt-2 text-xs text-rose-300">{rematch.error}</p>}
     </>}
    </div>}
   </aside>
  </div>
 </section>;
}
