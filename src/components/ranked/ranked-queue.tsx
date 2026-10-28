'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {changeRankedQueue,type QueueStatus} from '@/app/ranked/actions';
export function RankedQueue({initial}:{initial:QueueStatus}){
 const router=useRouter();
 const [local,setLocal]=useState<QueueStatus|null>(null);
 const [pending,setPending]=useState(false);
 const current=initial.status==='matched'?initial:local??initial;
 const matched=current.status==='matched'&&typeof current.matchId==='string';
 useEffect(()=>{if(matched)router.replace('/ranked/'+current.matchId);},[matched,current.matchId,router]);
 useEffect(()=>{
  if(current.status!=='queued')return;
  const timer=window.setInterval(()=>router.refresh(),3500);
  return ()=>window.clearInterval(timer);
 },[current.status,router]);
 async function execute(intent:'join'|'cancel'){
  if(pending)return;
  setPending(true);
  try{
   const next=await changeRankedQueue(intent);
   setLocal(next);
   router.refresh();
  }catch{setLocal({status:'idle',matchId:null,error:'매칭 요청에 실패했습니다.'});}
  finally{setPending(false);}
 }
 return <section className="mt-8 rounded-2xl border border-emerald-800/70 bg-emerald-950/35 p-6">
  <h2 className="text-xl font-extrabold">랜덤 랭크 매칭</h2>
  <p role="status" className="mt-3 text-sm text-slate-200">
   {matched?'대전 상대를 찾았습니다. 경기장으로 이동합니다.':
    current.status==='queued'?'비슷한 RP의 상대를 찾는 중입니다.':
    '랭크 매칭을 시작하면 비슷한 RP의 상대와 대전합니다.'}
  </p>
  {!matched&&<button type="button" onClick={()=>execute(current.status==='queued'?'cancel':'join')}
   disabled={pending}
   className={current.status==='queued'?'mt-5 rounded-xl border border-rose-400 px-5 py-3 font-semibold text-rose-200':'mt-5 rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950'}>
   {pending?'처리 중…':current.status==='queued'?'매칭 취소':'랭크 매칭 시작'}
  </button>}
  {current.error&&<p role="alert" className="mt-3 text-sm text-rose-300">{current.error}</p>}
  <p className="mt-4 text-xs text-slate-400">45초 동안 응답이 없는 대기 항목은 만료되며, 취소하면 RP가 변하지 않습니다.</p>
 </section>;
}
