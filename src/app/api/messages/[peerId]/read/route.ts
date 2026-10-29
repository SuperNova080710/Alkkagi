import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {isFriendId,isReadReceipt} from '@/lib/messages/validation';
import {messageData,messageError,messageRpcError,mutation} from '@/lib/messages/http';
export const runtime='nodejs';
export async function PUT(request:NextRequest,{params}:{params:Promise<{peerId:string}>}){
  const m=await mutation(request);
  if(!m.ok)return m.response;
  const {peerId}=await params;
  if(!isFriendId(peerId)||!isReadReceipt(m.body))
    return messageError('DM_INVALID_MESSAGE_ID',400);
  try{
    const {data,error}=await (await createClient()).rpc('mark_direct_messages_read',{
      p_peer:peerId,p_message_id:m.body.messageId,
    });
    if(error||!data||typeof data.lastReadId!=='string')return messageRpcError(error?.message);
    return messageData(data);
  }catch{return messageRpcError();}
}
