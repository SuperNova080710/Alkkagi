import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {friendMutation,friendData,friendDbFailure,friendError} from '@/lib/friends/http';
import {isFriendId,isFriendBlockInput} from '@/lib/friends/validation';
export const runtime='nodejs';
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const parsed=await friendMutation(request);
  if(!parsed.ok)return parsed.response;
  const {id}=await params;
  if(!isFriendId(id)||!isFriendBlockInput(parsed.body))
    return friendError('INVALID_BLOCK_TARGET',400);
  try{
    const {data,error}=await (await createClient()).rpc('set_player_block',{
      p_target:id,p_block:parsed.body.blocked,
    });
    if(error||!data)return friendDbFailure(error?.message);
    return friendData(data);
  }catch{return friendDbFailure();}
}
