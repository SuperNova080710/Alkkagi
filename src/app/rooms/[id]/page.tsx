import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {validBoard} from '@/lib/game/engine';
import {GameBoard} from '@/components/game/game-board';
import {RoomRefresh} from '@/components/rooms/room-refresh';
import {leaveRoom} from '../actions';
import {startGame} from '../start';
export const dynamic='force-dynamic';
type Room={id:string;code:string;status:string;yourSeat:number;players:{seat:number;nickname:string}[]};
export default async function RoomPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
 const user=await requireUser();
 const {id}=await params,query=await searchParams;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await createClient();
 const {data,error}=await db.rpc('get_casual_room',{p_room_id:id});
 if(error||!data||typeof data!=='object'||Array.isArray(data))notFound();
 const room=data as Room;
 if(!Array.isArray(room.players))notFound();
 const {data:match}=await db.from('matches').select('id,status,turn_user_id,turn_no,player1_id,player2_id,winner_id,board_state')
  .eq('room_id',id).maybeSingle();
 const hasMatch=Boolean(match&&validBoard(match.board_state));
 return <main className={hasMatch ? "game-page game-page--playing mx-auto max-w-6xl px-4 py-4 sm:px-6" : "mx-auto max-w-5xl px-6 py-12"}>
 <Link href="/lobby" className="game-page-back text-sm font-semibold text-emerald-300">← 로비</Link>
 <div className="game-page-header mt-8 flex flex-wrap items-center justify-between gap-4">
 <div><p className="text-sm font-bold tracking-widest text-emerald-300">일반전 · ALKKAGI ARENA</p>
 <h1 className="mt-3 text-4xl font-black">친구와 한 판</h1></div>
 <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-center">
 <p className="text-xs text-slate-400">초대 코드</p><p className="text-xl font-extrabold tracking-widest">{room.code}</p></div></div>
 {match&&validBoard(match.board_state)?<GameBoard match={{...match,board_state:match.board_state}} userId={user.id}/>:
 <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
  <h2 className="text-xl font-bold">참가자 {room.players.length}/2</h2>
  <ol className="mt-4 grid gap-3 sm:grid-cols-2">{[1,2].map(seat=><li key={seat} className="rounded-xl border border-slate-600 p-4">
  {seat===1?'선공':'후공'} · {room.players.find(p=>p.seat===seat)?.nickname??'친구 기다리는 중'} {room.yourSeat===seat?'(나)':''}</li>)}</ol>
  <RoomRefresh roomId={id}/>
  {room.status==='waiting'&&room.players.length===2&&room.yourSeat===1&&
    <form action={startGame} className="mt-6"><input type="hidden" name="id" value={id}/>
     <button className="rounded-xl bg-emerald-300 px-6 py-3 font-bold text-slate-950">경기 시작</button></form>}
  {room.status==='waiting'&&room.players.length<2&&
    <p className="mt-5 text-slate-300">친구에게 초대 코드를 보내면 자동으로 입장 상태가 갱신됩니다.</p>}
  {room.status==='waiting'&&<form action={leaveRoom} className="mt-5"><input type="hidden" name="id" value={id}/>
   <button className="rounded-xl border border-slate-500 px-5 py-3 text-sm">{room.yourSeat===1?'방 닫기':'방 나가기'}</button></form>}
  {query.error&&<p role="alert" className="mt-5 text-rose-300">경기를 시작할 수 없습니다. 새로고침 후 다시 시도해 주세요.</p>}
 </section>}
 </main>;
}
