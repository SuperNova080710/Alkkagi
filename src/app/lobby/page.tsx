import Link from 'next/link';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {LogoutForm} from '@/components/auth/logout-form';
import {RoomForms} from '@/components/rooms/room-forms';
export const dynamic='force-dynamic';
export default async function Lobby(){
 const user=await requireUser();
 const db=await createClient();
 const {data:profile}=await db.from('profiles').select('nickname').eq('id',user.id).maybeSingle();
 const {data:activeAi}=await db.from('ai_matches')
  .select('room_id,difficulty,created_at').eq('owner_id',user.id).eq('status','active')
  .order('created_at',{ascending:false}).limit(5);
 const {data:activeCasual}=await db.from('matches')
  .select('id,room_id,created_at').eq('mode','casual').eq('status','active')
  .order('created_at',{ascending:false}).limit(5);
 return <main className="mx-auto max-w-4xl px-6 py-16">
 <header className="flex items-center justify-between gap-4"><Link href="/" className="font-bold text-emerald-300">ALKKAGI ARENA</Link><LogoutForm /></header>
 <h1 className="mt-12 text-4xl font-bold">대전 로비</h1>
 <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-5 py-4">
  <div className="min-w-0"><p className="text-xs text-slate-400">내 닉네임</p>
   <p className="break-words font-bold text-emerald-200">{profile?.nickname??'프로필 확인 필요'}</p>
   <p className="mt-1 break-all text-xs text-slate-400">{user.email}</p></div>
  <Link href="/profile" className="shrink-0 rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200">
   닉네임 설정
  </Link>
 </div>
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
 {(activeAi??[]).length>0&&<section className="mt-8 rounded-2xl border border-sky-700 bg-sky-950/30 p-5">
  <h2 className="text-lg font-bold">진행 중인 AI 연습전</h2>
  <div className="mt-4 flex flex-wrap gap-2">{(activeAi??[]).map((m,i)=>
   <Link key={m.room_id} href={'/rooms/'+m.room_id+'/ai'}
    className="rounded-lg border border-sky-300 px-4 py-2 font-semibold text-sky-200">
    AI 대전 {i+1} 계속하기
   </Link>)}</div>
 </section>}
 <RoomForms />
 <p className="mt-8 text-slate-400">초대방 일반전·AI 연습전·랜덤 랭크전 중 원하는 모드로 1:1 알까기를 즐길 수 있습니다.</p>
 </main>;
}
