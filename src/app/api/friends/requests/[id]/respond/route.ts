import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {friendMutation,friendData,friendDbFailure,friendError} from '@/lib/friends/http';
import {isFriendId,isFriendRespondInput} from '@/lib/friends/validation';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const parsed=await friendMutation(request);
  if(!parsed.ok)return parsed.response;
  const {id}=await params;
  if(!isFriendId(id)||!isFriendRespondInput(parsed.body))
    return friendError('INVALID_FRIEND_REQUEST',400);
  try{
    const {data,error}=await (await createClient()).rpc('respond_friend_request',{
      p_request_id:id,p_accept:parsed.body.accept,
    });
    if(error||!data)return friendDbFailure(error?.message);
    return friendData(data);
  }catch{return friendDbFailure();}
}
