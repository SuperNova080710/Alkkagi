import type { NextRequest } from 'next/server';
import { withChessInvites } from '@/lib/chess/invites';
import { isFriendId } from '@/lib/friends/validation';
import { isInviteResponse } from '@/lib/room-invites/validation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  return withChessInvites(async (userId, body) => {
    const {id} = await params;
    if (!isFriendId(id) || !isInviteResponse(body))
      return {data: null, error: {message: 'INVALID_ROOM_INVITE'}};
    return createAdminClient().rpc('chess_respond_friend_invite', {
      actor: userId, p_invite_id: id, p_accept: body.accept,
    });
  }, request);
}
