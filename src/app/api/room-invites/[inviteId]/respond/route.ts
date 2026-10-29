import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {friendMutation} from '@/lib/friends/http';
import {isFriendId} from '@/lib/friends/validation';
import {friendData,friendError,inviteDbError} from '@/lib/room-invites/http';
import {isInviteResponse} from '@/lib/room-invites/validation';

export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{inviteId:string}>}){
  const parsed=await friendMutation(request);
  if(!parsed.ok)return parsed.response;
  const {inviteId}=await params;
  if(!isFriendId(inviteId)||!isInviteResponse(parsed.body))
    return friendError('INVALID_ROOM_INVITE',400);
  try{
    const {data,error}=await (await createClient()).rpc('respond_room_friend_invite',{
      p_invite_id:inviteId,p_accept:parsed.body.accept,
    });
    if(error||!data||typeof data.inviteId!=='string')
      return inviteDbError(error?.message);
    return friendData(data);
  }catch{return inviteDbError();}
}
