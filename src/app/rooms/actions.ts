'use server';
import { randomInt } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
export type RoomState = {error:string};
const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code=()=>Array.from({length:8},()=>abc[randomInt(abc.length)]).join('');
export async function createRoom(_s:RoomState):Promise<RoomState>{
 void _s;
 await requireUser();
 let id:string|null=null;
 try {
  const db=await createClient();
  for(let i=0;i<3;i++){
   const {data,error}=await db.rpc('create_casual_room',{p_code:code()});
   if(!error && typeof data==='string'){id=data;break;}
   if(error?.code!=='23505')return {error:'방을 만들 수 없습니다.'};
  }
 }catch{return {error:'방 서비스를 이용할 수 없습니다.'};}
 if(!id)return {error:'초대 코드를 만들지 못했습니다.'};
 redirect('/rooms/'+id);
}
export async function joinRoom(_s:RoomState,form:FormData):Promise<RoomState>{
 await requireUser();
 const raw=form.get('code');
 if(typeof raw!=='string')return {error:'초대 코드를 입력해 주세요.'};
 const invite=raw.trim().replace(/[\s-]/g,'').toUpperCase();
 if(!/^[A-HJ-NP-Z2-9]{8}$/.test(invite))return {error:'유효한 8자리 초대 코드를 입력해 주세요.'};
 let id:string|null=null;
 try{
  const {data,error}=await (await createClient()).rpc('join_casual_room',{p_code:invite});
  if(error)return {error:error.message==='ROOM_FULL'?'이미 두 명이 참가했습니다.':error.message==='ROOM_NOT_FOUND'?'방을 찾을 수 없습니다.':'참가할 수 없는 방입니다.'};
  if(typeof data==='string')id=data;
 }catch{return {error:'방 서비스를 이용할 수 없습니다.'};}
 if(!id)return {error:'방을 찾을 수 없습니다.'};
 redirect('/rooms/'+id);
}
export async function leaveRoom(form:FormData):Promise<void>{
 await requireUser();
 const id=form.get('id');
 if(typeof id==='string' && /^[0-9a-f-]{36}$/i.test(id)){
  try{await (await createClient()).rpc('leave_casual_room',{p_room_id:id});}catch{}
 }
 redirect('/lobby');
}
