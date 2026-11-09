import type { NextRequest } from 'next/server';
import { withChessInvites } from '@/lib/chess/invites';
import { isSendInvite } from '@/lib/room-invites/validation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  return withChessInvites(async userId =>
    createAdminClient().rpc('chess_list_received_invites', {actor: userId}));
}

export async function POST(request: NextRequest) {
  return withChessInvites(async (userId, body) => {
    if (!isSendInvite(body)) return {data: null, error: {message: 'INVALID_ROOM_INVITE'}};
    return createAdminClient().rpc('chess_send_friend_invite', {
      actor: userId, p_room_id: body.roomId, p_target_id: body.targetId,
    });
  }, request);
}
