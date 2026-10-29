import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {friendMutation,friendData,friendDbFailure,friendError} from '@/lib/friends/http';
import {isFriendTargetInput} from '@/lib/friends/validation';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  const parsed=await friendMutation(request);
  if(!parsed.ok)return parsed.response;
  if(!isFriendTargetInput(parsed.body))return friendError('INVALID_FRIEND_TARGET',400);
  try{
    const {data,error}=await (await createClient()).rpc('send_friend_request',{
      p_target:parsed.body.targetId,
    });
    if(error||!data)return friendDbFailure(error?.message);
    return friendData(data);
  }catch{return friendDbFailure();}
}
