import Link from 'next/link';
import {CopyInvite} from '@/components/rooms/copy-invite';
import {notFound,redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {validBoard} from '@/lib/game/engine';
import {GameBoard} from '@/components/game/game-board';
import {RoomRefresh} from '@/components/rooms/room-refresh';
import {AddAiOpponent} from '@/components/rooms/add-ai-opponent';
import {leaveRoom} from '../actions';
import {startGame} from '../start';
import {type TurnShot} from '@/lib/game/turn-history';
export const dynamic='force-dynamic';
type Room={id:string;code:string;status:string;yourSeat:number;rematchReadyCount?:number;myRematchVote?:boolean;players:{seat:number;nickname:string}[]};
export default async function RoomPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
 const user=await requireUser();
 const {id}=await params,query=await searchParams;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await createClient();
 const {data,error}=await db.rpc('get_casual_room',{p_room_id:id});
 if(error||!data||typeof data!=='object'||Array.isArray(data))notFound();
 const room=data as Room;
 if(!Array.isArray(room.players))notFound();
 const {data:aiMatch}=await db.from('ai_matches').select('room_id').eq('room_id',id).maybeSingle();
 if(aiMatch)redirect('/rooms/'+id+'/ai');
 const {data:match}=await db.from('matches').select('id,status,turn_user_id,turn_no,player1_id,player2_id,winner_id,board_state,turn_deadline,finished_at')
  .eq('room_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 const [{data:history},{data:chatHistory}]=match?await Promise.all([db.from('shots')
  .select('id,turn_no,player_id,piece_id,input,result_state,created_at')
  .eq('match_id',match.id).order('turn_no',{ascending:false}).limit(100),
  db.from('match_messages').select('id,sender_id,body,created_at')
   .eq('match_id',match.id).order('created_at',{ascending:false}).limit(100)
 ]):[{data:null},{data:null}];
 const shots=((history??[]) as TurnShot[]).reverse();
 const messages=((chatHistory??[]) as import('@/components/game/match-chat').MatchMessage[]).reverse();
 const hasMatch=Boolean(match&&validBoard(match.board_state));
 return <div className={hasMatch ? undefined : 'arena'}><main className={hasMatch ? "game-page game-page--playing mx-auto max-w-6xl px-4 py-4 sm:px-6" : "arena-waiting mx-auto max-w-5xl px-6 py-12"}>
 <Link href="/lobby" className="game-page-back text-sm font-semibold text-emerald-300">← 로비</Link>
 <div className="game-page-header mt-8 flex flex-wrap items-center justify-between gap-4">
 <div><p className="text-sm font-bold tracking-widest text-emerald-300">일반전 · ALKKAGI ARENA</p>
 <h1 className="mt-3 text-4xl font-black">친구와 한 판</h1></div>
 {hasMatch ? <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-center"><p className="text-xs text-slate-400">초대 코드</p><p className="text-xl font-extrabold tracking-widest">{room.code}</p></div> : <CopyInvite code={room.code}/>}</div>
 {match&&validBoard(match.board_state)?<GameBoard key={match.id} match={{...match,board_state:match.board_state}} userId={user.id}
 roomId={room.id} players={room.players} rematchReadyCount={room.rematchReadyCount??0}
 myRematchVote={room.myRematchVote??false} shots={shots} messages={messages}/>:
 <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
  <h2 className="text-xl font-bold">참가자 {room.players.length}/2</h2>
  <ol className="mt-4 grid gap-3 sm:grid-cols-2">{[1,2].map(seat=><li key={seat} className="rounded-xl border border-slate-600 p-4">
  {seat===1?'선공':'후공'} · {room.players.find(p=>p.seat===seat)?.nickname??'친구 기다리는 중'} {room.yourSeat===seat?'(나)':''}</li>)}</ol>
  <RoomRefresh roomId={id}/>
  {room.status==='waiting'&&room.players.length===2&&room.yourSeat===1&&
    <form action={startGame} className="mt-6"><input type="hidden" name="id" value={id}/>
     <button className="rounded-xl bg-emerald-300 px-6 py-3 font-bold text-slate-950">경기 시작</button></form>}
  {room.status==='waiting'&&room.players.length<2&&<>
    <p className="mt-5 text-slate-300">친구에게 초대 코드를 보내면 자동으로 입장 상태가 갱신됩니다.</p>
    {room.yourSeat===1&&<AddAiOpponent roomId={room.id}/>}
   </>}
  {room.status==='waiting'&&<form action={leaveRoom} className="mt-5"><input type="hidden" name="id" value={id}/>
   <button className="rounded-xl border border-slate-500 px-5 py-3 text-sm">{room.yourSeat===1?'방 닫기':'방 나가기'}</button></form>}
  {query.error&&<p role="alert" className="mt-5 text-rose-300">경기를 시작할 수 없습니다. 새로고침 후 다시 시도해 주세요.</p>}
 </section>}
 </main></div>;
}
