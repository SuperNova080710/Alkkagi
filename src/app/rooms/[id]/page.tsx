import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {leaveRoom} from '../actions';
export const dynamic='force-dynamic';
type Room={id:string;code:string;status:string;yourSeat:number;players:{seat:number;nickname:string}[]};
export default async function RoomPage({params}:{params:Promise<{id:string}>}){
 await requireUser();
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {data,error}=await (await createClient()).rpc('get_casual_room',{p_room_id:id});
 if(error||!data||typeof data!=='object'||Array.isArray(data))notFound();
 const room=data as Room;
 if(!Array.isArray(room.players))notFound();
 return <main className="mx-auto max-w-3xl px-6 py-16">
 <Link href="/lobby" className="text-emerald-300">← 로비</Link>
 <h1 className="mt-8 text-4xl font-bold">친구와 알까기</h1>
 <p className="mt-5 text-slate-300">아래 코드를 친구에게 전달하세요.</p>
 <p className="mt-3 rounded-xl bg-slate-800 p-6 text-center text-3xl font-bold tracking-widest" aria-label="초대 코드">{room.code}</p>
 <h2 className="mt-8 text-xl font-bold">참가자 {room.players.length}/2</h2>
 <ol className="mt-4 space-y-3">{[1,2].map(seat=><li key={seat} className="rounded-xl border border-slate-700 p-4">좌석 {seat} · {room.players.find(p=>p.seat===seat)?.nickname??'대기 중'} {room.yourSeat===seat?'(나)':''}</li>)}</ol>
 <p className="mt-6 text-slate-300">{room.players.length===2?'두 명이 참가했습니다. 게임 시작 기능은 다음 단계에서 연결됩니다.':'친구가 입장한 후 새로고침하면 확인할 수 있습니다.'}</p>
 {room.status==='waiting'&&<form action={leaveRoom} className="mt-6"><input type="hidden" name="id" value={room.id} /><button className="rounded-lg border border-slate-500 px-5 py-3">{room.yourSeat===1?'방 닫기':'방 나가기'}</button></form>}
 </main>;
}
