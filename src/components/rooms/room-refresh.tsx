'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {createBrowserClient} from '@supabase/ssr';
export function RoomRefresh({roomId}:{roomId:string}){
 const router=useRouter();
 useEffect(()=>{
  const timer=setInterval(()=>router.refresh(),3500);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return ()=>clearInterval(timer);
  const db=createBrowserClient(url,key);
  const channel=db.channel('room:'+roomId)
   .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_id=eq.'+roomId},()=>router.refresh())
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:'id=eq.'+roomId},()=>router.refresh())
   .subscribe();
  return ()=>{clearInterval(timer);void db.removeChannel(channel);};
 },[roomId,router]);
 return <p className="mt-5 text-xs text-slate-400">입장·경기 변경 사항을 자동으로 확인합니다.</p>;
}
