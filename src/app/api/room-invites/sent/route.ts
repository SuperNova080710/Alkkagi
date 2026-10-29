import {NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {isFriendId} from '@/lib/friends/validation';
import {friendData,friendError,inviteDbError} from '@/lib/room-invites/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  if(!await getVerifiedUser())return friendError('AUTH_REQUIRED',401);
  const query=request.nextUrl.searchParams;
  const keys=[...query.keys()];
  const roomId=query.get('roomId');
  if(keys.length!==1||keys[0]!=='roomId'||!isFriendId(roomId))
    return friendError('INVALID_ROOM_INVITE',400);
  try{
    const {data,error}=await (await createClient()).rpc('list_sent_room_invites',{
      p_room_id:roomId,
    });
    if(error||!Array.isArray(data))return inviteDbError(error?.message);
    return friendData(data);
  }catch{return inviteDbError();}
}
