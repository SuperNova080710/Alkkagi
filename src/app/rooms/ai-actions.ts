'use server';
import {randomInt} from 'node:crypto';
import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {isAiDifficulty} from '@/lib/ai/bot';

export type AiStartState={error:string};
export async function addAiOpponent(_state:AiStartState,form:FormData):Promise<AiStartState>{
 await requireUser();
 const roomId=form.get('roomId'),difficulty=form.get('difficulty');
 if(typeof roomId!=='string'||!/^[0-9a-f-]{36}$/i.test(roomId))return {error:'올바르지 않은 방입니다.'};
 if(!isAiDifficulty(difficulty))return {error:'난이도를 선택해 주세요.'};
 try{
  const {error}=await (await createClient()).rpc('start_ai_room',{
   p_room_id:roomId,p_difficulty:difficulty,
  });
  if(error)return {error:error.message.includes('ROOM_HAS_GUEST')?'이미 친구가 참가했습니다. 사람 대전을 시작해 주세요.':
   error.message.includes('NOT_HOST')?'방 주인만 AI를 추가할 수 있습니다.':
   'AI를 추가할 수 없습니다. 방 상태를 확인해 주세요.'};
 }catch{return {error:'AI 대전 시작 중 연결 오류가 발생했습니다.'};}
 redirect('/rooms/'+roomId+'/ai');
}
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){return Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');}
export async function newAiRematch(form:FormData):Promise<void>{
 await requireUser();
 const difficulty=form.get('difficulty');
 if(!isAiDifficulty(difficulty))redirect('/lobby');
 const db=await createClient();
 let roomId:string|null=null;
 for(let attempt=0;attempt<3;attempt++){
  const {data,error}=await db.rpc('create_casual_room',{p_code:newCode()});
  if(!error&&typeof data==='string'){roomId=data;break;}
  if(error?.code!=='23505')break;
 }
 if(!roomId)redirect('/lobby?error=ai');
 const {error}=await db.rpc('start_ai_room',{p_room_id:roomId,p_difficulty:difficulty});
 if(error)redirect('/rooms/'+roomId+'?error=ai');
 redirect('/rooms/'+roomId+'/ai');
}
