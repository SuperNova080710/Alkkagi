import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {friendDeletion,friendData,friendDbFailure,friendError} from '@/lib/friends/http';
import {isFriendId} from '@/lib/friends/validation';
export const runtime='nodejs';
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const denied=await friendDeletion(request);
  if(denied)return denied;
  const {id}=await params;
  if(!isFriendId(id))return friendError('INVALID_FRIEND_TARGET',400);
  try{
    const {data,error}=await (await createClient()).rpc('remove_friend',{p_target:id});
    if(error||typeof data!=='boolean')return friendDbFailure(error?.message);
    return friendData({removed:data});
  }catch{return friendDbFailure();}
}
