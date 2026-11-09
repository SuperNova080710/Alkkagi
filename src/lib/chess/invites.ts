import 'server-only';
import { getVerifiedUser } from '@/lib/auth/user';
import { friendMutation } from '@/lib/friends/http';
import { friendData, friendError, inviteDbError } from '@/lib/room-invites/http';
import type { NextRequest } from 'next/server';

export async function withChessInvites(
  handler: (userId: string, body: unknown) => Promise<{data: unknown; error: {message: string} | null}>,
  request?: NextRequest,
) {
  if (process.env.CHESS_UI_ENABLED !== 'true' || process.env.FRIENDS_UI_ENABLED !== 'true' ||
      process.env.ROOM_INVITES_UI_ENABLED !== 'true')
    return friendError('ROOM_INVITE_NOT_FOUND', 404);

  try {
    let userId: string;
    let body: unknown;
    if (request) {
      const parsed = await friendMutation(request);
      if (!parsed.ok) return parsed.response;
      ({userId, body} = parsed);
    } else {
      const user = await getVerifiedUser();
      if (!user) return friendError('AUTH_REQUIRED', 401);
      userId = user.id;
    }
    const {data, error} = await handler(userId, body);
    return error ? inviteDbError(error.message) : friendData(data);
  } catch {
    return inviteDbError();
  }
}
