import {NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {friendMutation} from '@/lib/friends/http';
import {friendData,friendError,inviteDbError} from '@/lib/room-invites/http';
import {isSendInvite} from '@/lib/room-invites/validation';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  if(!await getVerifiedUser())return friendError('AUTH_REQUIRED',401);
  try{
    const {data,error}=await (await createClient()).rpc('list_received_room_invites');
    if(error||!Array.isArray(data))return inviteDbError(error?.message);
    return friendData(data);
  }catch{return inviteDbError();}
}

export async function POST(request:NextRequest){
  const parsed=await friendMutation(request);
  if(!parsed.ok)return parsed.response;
  if(!isSendInvite(parsed.body))return friendError('INVALID_ROOM_INVITE',400);
  try{
    const {data,error}=await (await createClient()).rpc('send_room_friend_invite',{
      p_room_id:parsed.body.roomId,p_target_id:parsed.body.targetId,
    });
    if(error||!data||typeof data.inviteId!=='string')
      return inviteDbError(error?.message);
    return friendData(data);
  }catch{return inviteDbError();}
}
