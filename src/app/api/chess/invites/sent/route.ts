import type { NextRequest } from 'next/server';
import { withChessInvites } from '@/lib/chess/invites';
import { isFriendId } from '@/lib/friends/validation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  return withChessInvites(async userId => {
    const query = request.nextUrl.searchParams;
    const roomId = query.get('roomId');
    if (query.size !== 1 || !isFriendId(roomId))
      return {data: null, error: {message: 'INVALID_ROOM_INVITE'}};
    return createAdminClient().rpc('chess_list_sent_invites', {actor: userId, p_room_id: roomId});
  });
}
