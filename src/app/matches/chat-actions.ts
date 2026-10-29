'use server';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';

export type ChatResult={ok:boolean;message:string};
const isUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function sendMatchMessage(matchId:string,body:string):Promise<ChatResult>{
 await requireUser();
 if(!isUuid(matchId))return {ok:false,message:'경기 정보가 올바르지 않습니다.'};
 if(body.trim().length===0||body.trim().length>280)return {ok:false,message:'메시지는 1~280자로 입력해 주세요.'};
 try{
  const {error}=await (await createClient()).rpc('send_match_message',{p_match_id:matchId,p_body:body});
  if(!error)return {ok:true,message:''};
  const code=error.message;
  if(code.includes('CHAT_RATE_LIMIT'))return {ok:false,message:'메시지는 1초 간격으로 보낼 수 있습니다.'};
  if(code.includes('CHAT_FULL'))return {ok:false,message:'이 경기의 채팅 메시지 한도에 도달했습니다.'};
  if(code.includes('CHAT_CLOSED'))return {ok:false,message:'종료된 지 30분이 지난 경기에서는 채팅할 수 없습니다.'};
  if(code.includes('MESSAGE_INVALID'))return {ok:false,message:'메시지는 1~280자로 입력해 주세요.'};
  if(code.includes('MATCH_NOT_FOUND'))return {ok:false,message:'이 경기의 참가자만 채팅할 수 있습니다.'};
 }catch{}
 return {ok:false,message:'메시지를 전송하지 못했습니다. 다시 시도해 주세요.'};
}
