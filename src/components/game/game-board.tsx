'use client';
import {useEffect,useState,type PointerEvent} from 'react';
import {useRouter} from 'next/navigation';
import {createBrowserClient} from '@supabase/ssr';
import {HEIGHT,RADIUS,WIDTH,type Board} from '@/lib/game/engine';
type Match={
 id:string;status:string;turn_user_id:string;turn_no:number;
 player1_id:string;player2_id:string;winner_id:string|null;board_state:Board;
};
type Point={x:number;y:number};
type Drag={id:string;origin:Point;at:Point};
export function GameBoard({match,userId}:{match:Match;userId:string}){
 const router=useRouter();
 const [drag,setDrag]=useState<Drag|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');
 const myTurn=match.status==='active'&&match.turn_user_id===userId;
 useEffect(()=>{
  const timer=setInterval(()=>router.refresh(),4000);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return ()=>clearInterval(timer);
  const db=createBrowserClient(url,key);
  const channel=db.channel('game:'+match.id)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'id=eq.'+match.id},
    ()=>router.refresh()).subscribe();
  return ()=>{clearInterval(timer);void db.removeChannel(channel);};
 },[match.id,router]);
 function location(event:PointerEvent<SVGSVGElement>):Point{
  const r=event.currentTarget.getBoundingClientRect();
  return {x:(event.clientX-r.left)*WIDTH/r.width,y:(event.clientY-r.top)*HEIGHT/r.height};
 }
 function down(event:PointerEvent<SVGSVGElement>){
  if(!myTurn||pending)return;
  const p=location(event);
  const piece=match.board_state.pieces.find(q=>q.owner===userId&&Math.hypot(q.x-p.x,q.y-p.y)<RADIUS+8);
  if(!piece)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  setDrag({id:piece.id,origin:{x:piece.x,y:piece.y},at:p});
 }
 function move(event:PointerEvent<SVGSVGElement>){
  if(!drag)return;
  setDrag({...drag,at:location(event)});
 }
 async function up(event:PointerEvent<SVGSVGElement>){
  if(!drag)return;
  const p=location(event),d=drag;setDrag(null);
  if(!myTurn||pending)return;
  let dx=d.origin.x-p.x,dy=d.origin.y-p.y;
  const len=Math.hypot(dx,dy);
  if(len<5)return;
  if(len>160){dx=dx*160/len;dy=dy*160/len;}
  setPending(true);setError('');
  try{
   const response=await fetch('/api/matches/'+match.id+'/shot',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pieceId:d.id,turnNo:match.turn_no,dx,dy,requestId:crypto.randomUUID()})
   });
   if(!response.ok)throw Error(response.status===409?'이미 처리된 턴입니다.':'발사에 실패했습니다.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'연결 오류가 발생했습니다.');}
  finally{setPending(false);}
 }
 async function forfeit(){
  if(!window.confirm('정말 기권하시겠습니까?'))return;
  setPending(true);setError('');
  try{
   const r=await fetch('/api/matches/'+match.id+'/forfeit',{method:'POST'});
   if(!r.ok)throw Error('기권을 처리하지 못했습니다.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'연결 오류');}
  finally{setPending(false);}
 }
 const player1=match.board_state.pieces.filter(p=>p.owner===match.player1_id).length;
 const player2=match.board_state.pieces.filter(p=>p.owner===match.player2_id).length;
 const score='선공 '+player1+'개 · 후공 '+player2+'개';
 return <section className="mt-8">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-2xl font-extrabold">알까기 대전</h2>
   <p className="mt-2 text-slate-300" aria-live="polite">{match.status==='finished'
    ? match.winner_id===userId?'승리했습니다!':match.winner_id?'패배했습니다.':'무승부입니다.'
    : myTurn?'내 차례입니다. 내 알을 잡아 뒤로 드래그하세요.':'상대방의 차례입니다.'}</p></div>
   <span className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold">{score}</span>
  </div>
  <div className="mt-5 overflow-hidden rounded-3xl border-8 border-amber-900 bg-emerald-950 shadow-2xl">
   <svg viewBox="0 0 800 500" role="img" aria-label="알까기 게임판. 내 알을 뒤로 드래그해서 상대 알을 밀어내세요."
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>setDrag(null)}
    style={{touchAction:'none',width:'100%',display:'block',cursor:myTurn?'crosshair':'default'}}>
    <rect x="0" y="0" width="800" height="500" fill="#064e3b"/>
    <rect x="23" y="23" width="754" height="454" fill="none" stroke="#34d399" strokeOpacity="0.18" strokeWidth="2"/>
    <path d="M400 20 V480" stroke="#34d399" strokeOpacity="0.15" strokeDasharray="8 10" strokeWidth="3"/>
    {match.board_state.pieces.map(piece=><g key={piece.id}>
     <circle cx={piece.x+2} cy={piece.y+4} r={RADIUS+1} fill="#000" opacity="0.28"/>
     <circle cx={piece.x} cy={piece.y} r={RADIUS} fill={piece.owner===match.player1_id?'#f59e0b':'#60a5fa'}
      stroke={piece.owner===userId?'#fef3c7':'#bfdbfe'} strokeWidth="2.5"/>
     <circle cx={piece.x-5} cy={piece.y-5} r="5" fill="#fff" opacity="0.45"/>
    </g>)}
    {drag&&<g>
      <line x1={drag.origin.x} y1={drag.origin.y} x2={drag.origin.x+(drag.origin.x-drag.at.x)}
       y2={drag.origin.y+(drag.origin.y-drag.at.y)} stroke="#fef08a" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 5"/>
      <circle cx={drag.origin.x} cy={drag.origin.y} r={RADIUS+5} stroke="#fef08a" fill="none" strokeWidth="2" strokeDasharray="4 4"/>
    </g>}
   </svg>
  </div>
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
   <p>턴 {match.turn_no} · 알이 판 밖으로 밀려나면 제거됩니다.</p>
   {match.status==='active'&&<button onClick={forfeit} disabled={pending}
    className="rounded-lg border border-rose-400 px-4 py-2 font-semibold text-rose-300 disabled:opacity-50">기권하기</button>}
  </div>
  {pending&&<p role="status" className="mt-4 text-amber-200">서버에서 판정 중입니다…</p>}
  {error&&<p role="alert" className="mt-4 text-rose-300">{error}</p>}
 </section>;
}
