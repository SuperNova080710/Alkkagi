'use server';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
export type QueueStatus={status:'idle'|'queued'|'matched';matchId:string|null;error?:string};
export async function changeRankedQueue(intent:'join'|'cancel'):Promise<QueueStatus>{
 await requireUser();
 try{
  const {data,error}=await (await createClient()).rpc(intent==='join'?'join_ranked_queue':'cancel_ranked_queue');
  if(error)return {status:'idle',matchId:null,error:error.message==='ACTIVE_CASUAL_MATCH'?
   '진행 중인 일반전을 먼저 마쳐 주세요.':'매칭 상태를 변경하지 못했습니다.'};
  if(intent==='cancel')return {status:'idle',matchId:null};
  const value=data as {status?:string;matchId?:string|null};
  if(value.status==='queued')return {status:'queued',matchId:null};
  if(value.status==='matched'&&typeof value.matchId==='string')
   return {status:'matched',matchId:value.matchId};
 }catch{}
 return {status:'idle',matchId:null,error:'매칭 서버에 연결하지 못했습니다.'};
}
