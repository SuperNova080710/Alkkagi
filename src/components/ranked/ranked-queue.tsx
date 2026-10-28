'use client';
import { useActionState,useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { emptyQueue,enterRankedQueue,leaveRankedQueue } from '@/app/ranked/actions';
type QueueStatus={status:string;matchId?:string|null};
export function RankedQueue({initial}:{initial:QueueStatus}){
 const router=useRouter();
 const [join,joinAction,joining]=useActionState(enterRankedQueue,emptyQueue);
 const [cancel,cancelAction,canceling]=useActionState(leaveRankedQueue,emptyQueue);
 const current=join.status==='queued'||join.status==='matched'?join:
  cancel.error?cancel:join.error?join:
  initial.status==='queued'&&cancel.status!=='idle'?{...emptyQueue,status:'queued' as const}:initial;
 const matchId=join.matchId??initial.matchId;
 const matched=current.status==='matched'&&typeof matchId==='string';
 useEffect(()=>{if(matched)router.push('/ranked/'+matchId);},[matched,matchId,router]);
 useEffect(()=>{
  if(current.status!=='queued')return;
  const timer=setInterval(()=>router.refresh(),3500);
  return ()=>clearInterval(timer);
 },[current.status,router]);
 return <section className="mt-8 rounded-2xl border border-emerald-800/70 bg-emerald-950/35 p-6">
  <h2 className="text-xl font-extrabold">랜덤 랭크 매칭</h2>
  <p role="status" className="mt-3 text-sm text-slate-200">
   {matched?'대전 상대를 찾았습니다. 이동 중입니다…':
    current.status==='queued'?'비슷한 RP의 상대를 찾는 중입니다.':
    '랭크 매칭을 시작하면 비슷한 RP의 상대와 대전합니다.'}
  </p>
  {current.status==='queued'?<form action={cancelAction} className="mt-5">
   <button disabled={canceling} className="rounded-xl border border-rose-400 px-5 py-3 font-semibold text-rose-200">
    {canceling?'취소 중…':'매칭 취소'}
   </button>
  </form>:!matched&&<form action={joinAction} className="mt-5">
   <button disabled={joining} className="rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950">
    {joining?'매칭 중…':'랭크 매칭 시작'}
   </button>
  </form>}
  {(join.error||cancel.error)&&<p role="alert" className="mt-3 text-sm text-rose-300">{join.error||cancel.error}</p>}
  <p className="mt-4 text-xs text-slate-400">취소 후에는 RP가 변경되지 않습니다. 현재 큐는 일정 시간 응답이 없으면 만료됩니다.</p>
 </section>;
}
