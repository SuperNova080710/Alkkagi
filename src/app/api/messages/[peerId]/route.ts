import {NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {isFriendId,isSendMessage,parseMessagePage} from '@/lib/messages/validation';
import {messageData,messageError,messageRpcError,mutation} from '@/lib/messages/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{peerId:string}>};
export async function GET(request:NextRequest,{params}:Context){
  if(!await getVerifiedUser())return messageError('AUTH_REQUIRED',401);
  const {peerId}=await params;
  const query=parseMessagePage(request.nextUrl);
  if(!isFriendId(peerId)||query===null)return messageError('DM_INVALID_PAGE',400);
  try{
    const {data,error}=await (await createClient()).rpc('get_direct_messages',{
      p_peer:peerId,p_before_id:query.beforeId,p_limit:query.limit,
    });
    if(error||!data||!Array.isArray(data.messages))return messageRpcError(error?.message);
    return messageData(data);
  }catch{return messageRpcError();}
}
export async function POST(request:NextRequest,{params}:Context){
  const m=await mutation(request);
  if(!m.ok)return m.response;
  const {peerId}=await params;
  if(!isFriendId(peerId)||!isSendMessage(m.body))return messageError('DM_INVALID_MESSAGE',400);
  try{
    const {data,error}=await (await createClient()).rpc('send_direct_message',{
      p_peer:peerId,p_body:m.body.body,p_request_id:m.body.requestId,
    });
    if(error||!data||typeof data.id!=='string')return messageRpcError(error?.message);
    return messageData(data);
  }catch{return messageRpcError();}
}
