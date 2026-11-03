'use client';
import {CourtSurface} from './court-surface';
import {useEffect,useState,type PointerEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {createBrowserClient} from '@supabase/ssr';
import {HEIGHT,MAX_FORCE,MIN_FORCE,RADIUS,WIDTH,type Board,type Shot} from '@/lib/game/engine';
import {viewportToBoard} from '@/lib/game/coordinates';
import {GamePieces} from '@/components/game/game-pieces';
import {useMatchCosmetics} from '@/components/game/use-match-cosmetics';
import {GameFeedback} from '@/components/game/game-feedback';
import {GameIdentityHeading} from '@/components/game/game-identity-heading';
import {getPlayerIdentities} from '@/lib/game/player-identity';
import {AI_BOT_ID,DIFFICULTY_LABELS,type AiDifficulty} from '@/lib/ai/bot';
import {keyboardVector,DIRECTIONS,type Direction} from '@/lib/game/keyboard-shot';
import {newAiRematch} from '@/app/rooms/ai-actions';

export type AiGame={
 room_id:string;owner_id:string;difficulty:AiDifficulty;
 status:'active'|'finished';board_state:Board;turn_no:number;
 winner_id:string|null;
};
export type AiTurn={
 turn_no:number;human_input:Shot;human_frames:Board[];
 ai_input:Shot|null;ai_frames:Board[]|null;
};
type Props={game:AiGame;nickname:string;turns:AiTurn[];cosmeticsEnabled?:boolean};
type Drag={id:string;origin:{x:number;y:number};at:{x:number;y:number}};
type Playback={frames:Board[];index:number;humanFrames:number};
export function AiGameBoard({game,nickname,turns,cosmeticsEnabled=false}:Props){
 const router=useRouter();
 // The AI opponent is never an account with a public cosmetic loadout.
 const cosmetics=useMatchCosmetics(game.owner_id,null,cosmeticsEnabled);
 const [drag,setDrag]=useState<Drag|null>(null);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [playback,setPlayback]=useState<Playback|null>(null);
 const [keyboardPiece,setKeyboardPiece]=useState('');
 const [keyboardDirection,setKeyboardDirection]=useState<Direction>('right');
 const [keyboardPower,setKeyboardPower]=useState(80);
 const last=turns.at(-1);
 const [lastAnimatedTurn,setLastAnimatedTurn]=useState(last?.turn_no??0);
 const justUpdated=Boolean(last&&lastAnimatedTurn!==last.turn_no);
 const board=playback?playback.frames[playback.index]:game.board_state;
 const playing=game.status==='active'&&!pending&&!playback&&!justUpdated;
 const myPieces=board.pieces.filter(piece=>piece.owner===game.owner_id);
 const matchInfo={
  player1_id:game.owner_id,player2_id:AI_BOT_ID,turn_user_id:game.owner_id,
  status:game.status,winner_id:game.winner_id,
 };
 const identities=getPlayerIdentities(matchInfo,game.owner_id,
  [{seat:1,nickname},{seat:2,nickname:'AI · '+DIFFICULTY_LABELS[game.difficulty]}],board);
 useEffect(()=>{
  const poll=window.setInterval(()=>router.refresh(),5000);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return ()=>window.clearInterval(poll);
  const db=createBrowserClient(url,key);
  const channel=db.channel('ai-room:'+game.room_id).on('postgres_changes',{
   event:'UPDATE',schema:'public',table:'ai_matches',filter:'room_id=eq.'+game.room_id,
  },()=>router.refresh()).subscribe();
  return ()=>{window.clearInterval(poll);void db.removeChannel(channel);};
 },[game.room_id,router]);
 useEffect(()=>{
  if(!last||last.turn_no===lastAnimatedTurn)return;
  const human=Array.isArray(last.human_frames)?last.human_frames:[];
  const ai=Array.isArray(last.ai_frames)?last.ai_frames:[];
  const frames=[...human,...ai];
  const raf=window.requestAnimationFrame(()=>{
   setLastAnimatedTurn(last.turn_no);
   if(frames.length>=2&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setPlayback({frames,index:0,humanFrames:human.length});
  });
  return ()=>window.cancelAnimationFrame(raf);
 },[last,lastAnimatedTurn]);
 useEffect(()=>{
  if(!playback)return;
  const interval=window.setInterval(()=>setPlayback(state=>{
   if(!state)return null;
   return state.index>=state.frames.length-1?null:{...state,index:state.index+1};
  }),24);
  return ()=>window.clearInterval(interval);
 },[playback]);
 function point(e:PointerEvent<SVGSVGElement>){
  return viewportToBoard(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect());
 }
 function down(e:PointerEvent<SVGSVGElement>){
  if(!playing)return;
  const at=point(e);
  if(!at||at.x<0||at.x>WIDTH||at.y<0||at.y>HEIGHT)return;
  const piece=myPieces.find(p=>Math.hypot(p.x-at.x,p.y-at.y)<RADIUS+8);
  if(!piece)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  setDrag({id:piece.id,origin:{x:piece.x,y:piece.y},at});
 }
 function move(e:PointerEvent<SVGSVGElement>){
  if(!drag)return;
  const at=point(e);if(at)setDrag({...drag,at});
 }
 async function shoot(shot:Shot){
  if(!playing)return;
  setPending(true);setError('');
  try{
   const res=await fetch('/api/ai/'+game.room_id+'/shot',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...shot,turnNo:game.turn_no}),
   });
   if(!res.ok)throw Error(res.status===409?'턴이 이미 진행됐습니다. 경기 정보를 새로고칩니다.':
    res.status===429?'발사 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.':
    res.status===400?'발사 방향과 세기를 확인해 주세요.':'AI 발사 처리를 완료하지 못했습니다.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'연결 오류가 발생했습니다.');router.refresh();}
  finally{setPending(false);}
 }
 async function up(e:PointerEvent<SVGSVGElement>){
  if(!drag)return;
  const at=point(e),start=drag;setDrag(null);
  if(!at||!playing)return;
  let dx=start.origin.x-at.x,dy=start.origin.y-at.y;
  const magnitude=Math.hypot(dx,dy);
  if(magnitude<MIN_FORCE)return;
  if(magnitude>MAX_FORCE){dx*=MAX_FORCE/magnitude;dy*=MAX_FORCE/magnitude;}
  await shoot({pieceId:start.id,dx,dy});
 }
 async function keyboardFire(){
  if(!myPieces.length||!playing)return;
  const piece=myPieces.find(p=>p.id===keyboardPiece)??myPieces[0];
  const power=keyboardVector(keyboardDirection,keyboardPower);
  await shoot({pieceId:piece.id,...power});
 }
 async function forfeit(){
  if(!window.confirm('AI 대전을 기권하시겠습니까?'))return;
  setPending(true);setError('');
  try{
   const response=await fetch('/api/ai/'+game.room_id+'/forfeit',{method:'POST'});
   if(!response.ok)throw Error('기권 처리 중 오류가 발생했습니다.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'기권에 실패했습니다.');}
  finally{setPending(false);}
 }
 const strength=drag?Math.min(MAX_FORCE,Math.hypot(drag.origin.x-drag.at.x,drag.origin.y-drag.at.y)):null;
 const finished=game.status==='finished'&&!playback&&!justUpdated;
 const aiIsMoving=playback&&playback.index>=playback.humanFrames;
 return <section className="game-screen mt-8">
  <GameIdentityHeading match={matchInfo} viewerId={game.owner_id} players={identities}
   mode="ai" animating={!!playback||justUpdated} pending={pending} remaining={null}
   cosmetics={cosmetics} cosmeticsEnabled={cosmeticsEnabled}/>
  <div className="game-screen-body">
   <aside className="game-chat-panel rounded-2xl border border-sky-700/70 bg-slate-900/95 p-4">
    <h3 className="border-b border-slate-700 pb-3 text-lg font-bold">AI 대전</h3>
    <p className="mt-3 text-sm text-slate-200">난이도 · <strong>{DIFFICULTY_LABELS[game.difficulty]}</strong></p>
    <p className="mt-3 text-sm leading-6 text-slate-300">
     {game.difficulty==='easy'?'AI가 대략적인 방향으로 발사합니다. 연습하며 세기와 각도를 익혀 보세요.':
      game.difficulty==='normal'?'AI가 여러 발사 후보를 물리 시뮬레이션으로 비교합니다.':
      'AI가 더 많은 후보를 비교해 상대 알 제거와 자기 알 생존을 함께 판단합니다.'}
    </p>
    <div className="mt-4 rounded-xl bg-slate-800/70 p-3 text-sm text-slate-200" role="status">
     {aiIsMoving?'AI가 발사한 알이 이동 중입니다.':
      playback?'내 발사 결과 재생 중입니다.':
      pending?'AI가 발사 후보를 계산하고 있습니다.':
      finished?'AI 대전이 종료됐습니다.':'내 주황색 알을 뒤로 드래그해 발사하세요.'}
    </div>
    <p className="mt-4 text-xs text-slate-400">AI 연습전은 랭크 점수 및 순위에 반영되지 않습니다.</p>
   </aside>
   <div className="game-screen-main">
    <div className="game-screen-stage relative overflow-hidden rounded-3xl border-8 border-amber-900 bg-emerald-950 shadow-2xl">
     <svg viewBox="0 0 800 500" role="img" aria-label="AI 알까기 보드. 내 주황색 알을 뒤로 끌어 발사합니다."
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerCancel={()=>setDrag(null)}
      style={{touchAction:'none',width:'100%',display:'block',cursor:playing?'crosshair':'default'}}>
      <CourtSurface/>
      <GamePieces board={board} firstPlayerId={game.owner_id} viewerId={game.owner_id} cosmetics={cosmetics}/>
      {drag&&<g>
       <line x1={drag.origin.x} y1={drag.origin.y} x2={drag.origin.x+(drag.origin.x-drag.at.x)}
        y2={drag.origin.y+(drag.origin.y-drag.at.y)} stroke="#fef08a"
        strokeWidth="5" strokeLinecap="round" strokeDasharray="8 5"/>
       <circle cx={drag.origin.x} cy={drag.origin.y} r={RADIUS+5}
        stroke="#fef08a" fill="none" strokeWidth="2" strokeDasharray="4 4"/>
      </g>}
     </svg>
     {finished&&<div className="game-result-overlay absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3">
      <div className="game-result-card w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-950/95 p-6 text-center shadow-2xl" role="status">
       <p className="text-xs font-bold tracking-[.2em] text-slate-400">AI PRACTICE RESULT</p>
       <h3 className={'mt-2 text-4xl font-black '+(game.winner_id===game.owner_id?'text-emerald-300':'text-rose-300')}>
        {game.winner_id===null?'무승부':game.winner_id===game.owner_id?'승리':'패배'}</h3>
       <p className="mt-2 text-sm text-slate-300">AI {DIFFICULTY_LABELS[game.difficulty]} · RP 변동 없음</p>
       <div className="mt-5 flex flex-col gap-2">
        <Link href="/lobby" className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold">로비로 돌아가기</Link>
        <form action={newAiRematch}><input type="hidden" name="difficulty" value={game.difficulty}/>
         <button className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950">
          같은 난이도로 재도전</button></form>
       </div>
      </div>
     </div>}
    </div>
    <div className="game-screen-bottom mt-3">
     <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
      <p>연습 턴 {game.turn_no} · 제한 세기 {MAX_FORCE}</p>
      {game.status==='active'&&<button type="button" onClick={forfeit} disabled={pending||!!playback}
       className="rounded-lg border border-rose-400 px-4 py-2 font-semibold text-rose-300 disabled:opacity-50">
       기권하기</button>}
     </div>
     <GameFeedback power={strength} pending={pending} error={error}/>
    </div>
   </div>
   <aside className="game-turn-log rounded-2xl border border-slate-700 bg-slate-900/95 p-4">
    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-3">
     <h3 className="font-bold">턴 기록</h3>
     <span className="text-xs text-slate-400">{turns.length}턴</span>
    </div>
    <ol className="game-turn-list mt-3 space-y-2 pr-1">
     {[...turns].reverse().map(turn=><li key={turn.turn_no}
      className="rounded-lg border border-slate-700 bg-slate-800/75 p-3 text-xs text-slate-200">
      <p className="font-bold text-emerald-300">TURN {turn.turn_no}</p>
      <p className="mt-2">나: {turn.human_input.pieceId} 발사</p>
      {turn.ai_input&&<p className="mt-1">AI: {turn.ai_input.pieceId} 응수</p>}
      {!turn.ai_input&&<p className="mt-1">AI 응수 전 경기 종료</p>}
     </li>)}
     {turns.length===0&&<li className="rounded-lg bg-slate-800 p-3 text-sm text-slate-400">첫 발사를 기다립니다.</li>}
    </ol>
    {game.status==='active'&&<details className="mt-3 border-t border-slate-700 pt-3 text-sm">
     <summary className="cursor-pointer font-semibold text-emerald-300">키보드 조작</summary>
     <label htmlFor="ai-piece" className="mt-3 block text-xs">내 알</label>
     <select id="ai-piece" className="mt-1 w-full rounded-lg bg-slate-800 p-2"
      value={myPieces.some(p=>p.id===keyboardPiece)?keyboardPiece:myPieces[0]?.id??''}
      onChange={e=>setKeyboardPiece(e.target.value)}>
      {myPieces.map(p=><option key={p.id} value={p.id}>{p.id}</option>)}
     </select>
     <label htmlFor="ai-direction" className="mt-3 block text-xs">방향</label>
     <select id="ai-direction" className="mt-1 w-full rounded-lg bg-slate-800 p-2"
      value={keyboardDirection} onChange={e=>setKeyboardDirection(e.target.value as Direction)}>
      {DIRECTIONS.map(dir=><option key={dir.value} value={dir.value}>{dir.label}</option>)}
     </select>
     <label htmlFor="ai-power" className="mt-3 block text-xs">세기 {keyboardPower}</label>
     <input id="ai-power" type="range" min={9} max={MAX_FORCE} value={keyboardPower}
      onChange={e=>setKeyboardPower(Number(e.target.value))} className="mt-2 w-full accent-emerald-300"/>
     <button onClick={keyboardFire} type="button" disabled={!playing||!myPieces.length}
      className="mt-3 w-full rounded-lg bg-emerald-300 p-2 font-bold text-slate-950 disabled:opacity-50">발사</button>
    </details>}
   </aside>
  </div>
 </section>;
}
