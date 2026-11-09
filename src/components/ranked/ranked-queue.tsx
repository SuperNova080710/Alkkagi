'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import { RankedQueuePanel } from './ranked-queue-panel';
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
 return <RankedQueuePanel status={current.status} pending={pending} error={current.error}
  onChange={intent=>void execute(intent)}/>;
}
