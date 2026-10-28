import Link from 'next/link';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {LogoutForm} from '@/components/auth/logout-form';
import {RoomForms} from '@/components/rooms/room-forms';
export const dynamic='force-dynamic';
export default async function Lobby(){
 const user=await requireUser();
 const {data:activeCasual}=await (await createClient()).from('matches')
  .select('id,room_id,created_at').eq('mode','casual').eq('status','active')
  .order('created_at',{ascending:false}).limit(5);
 return <main className="mx-auto max-w-4xl px-6 py-16">
 <header className="flex items-center justify-between gap-4"><Link href="/" className="font-bold text-emerald-300">ALKKAGI ARENA</Link><LogoutForm /></header>
 <h1 className="mt-12 text-4xl font-bold">대전 로비</h1>
 <p className="mt-4 break-all text-slate-300">{user.email} 계정으로 로그인했습니다.</p>
 <div className="mt-8 rounded-2xl border border-amber-600/60 bg-amber-950/30 p-6">
 <h2 className="text-2xl font-bold">랭크전</h2>
 <p className="mt-2 text-slate-300">랜덤 상대와 겨뤄 RP를 쌓고 순위에 도전하세요.</p>
 <Link href="/ranked" className="mt-4 inline-block rounded-lg bg-amber-300 px-5 py-3 font-bold text-slate-950">랭크 아레나 입장</Link>
 </div>
 {(activeCasual??[]).length>0&&<section className="mt-8 rounded-2xl border border-emerald-700 bg-emerald-950/30 p-5">
  <h2 className="text-lg font-bold">진행 중인 일반전</h2>
  <p className="mt-2 text-sm text-slate-300">연결이 끊어져도 저장된 경기로 돌아올 수 있습니다.</p>
  <div className="mt-4 flex flex-wrap gap-2">{(activeCasual??[]).map((m,i)=>
   <Link key={m.id} href={'/rooms/'+m.room_id} className="rounded-lg border border-emerald-300 px-4 py-2 font-semibold text-emerald-300">
    진행 중인 경기 {i+1} 복귀
   </Link>)}</div>
 </section>}
 <RoomForms />
 <p className="mt-8 text-slate-400">초대방 일반전과 랜덤 랭크전 중 원하는 모드로 1:1 알까기를 즐길 수 있습니다.</p>
 </main>;
}
