'use server';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
export type QueueActionState = { error: string; status: 'idle'|'queued'|'matched'; matchId: string|null };
export const emptyQueue: QueueActionState = { error:'', status:'idle', matchId:null };
export async function enterRankedQueue(_prev:QueueActionState):Promise<QueueActionState> {
 await requireUser();
 void _prev;
 try {
  const {data,error}=await (await createClient()).rpc('join_ranked_queue');
  if(error)return {...emptyQueue,error:error.message==='ACTIVE_CASUAL_MATCH'
   ?'진행 중인 일반전을 먼저 마쳐 주세요.':'랭크 매칭을 시작하지 못했습니다.'};
  const result=data as {status?:string;matchId?:string|null};
  if(result.status==='queued')return {error:'',status:'queued',matchId:null};
  if(result.status==='matched'&&typeof result.matchId==='string')
    return {error:'',status:'matched',matchId:result.matchId};
 } catch {}
 return {...emptyQueue,error:'매칭 서버에 연결하지 못했습니다.'};
}
export async function leaveRankedQueue(_prev:QueueActionState):Promise<QueueActionState>{
 await requireUser();
 void _prev;
 try {
  const {error}=await (await createClient()).rpc('cancel_ranked_queue');
  if(!error)return emptyQueue;
 }catch{}
 return {...emptyQueue,error:'취소 여부를 확인할 수 없습니다. 새로고침해 주세요.'};
}
