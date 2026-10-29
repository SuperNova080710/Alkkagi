import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {messageData,messageError,messageRpcError} from '@/lib/messages/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  if(!await getVerifiedUser())return messageError('AUTH_REQUIRED',401);
  try{
    const {data,error}=await (await createClient()).rpc('get_direct_message_inbox');
    if(error||!Array.isArray(data))return messageRpcError(error?.message);
    return messageData(data);
  }catch{return messageRpcError();}
}
