import { createAdminClient } from '@/lib/supabase/admin';
import {
  chessBody, chessDbError, ChessError, chessInviteCode, normalizeChessInvite, requireChessId, withChessUser,
} from '@/lib/chess/http';

export async function POST(request: Request) {
  return withChessUser(async userId => {
    const body = await chessBody(request);
    if (body.action === 'join') {
      const code = normalizeChessInvite(body.code);
      const {data, error} = await createAdminClient().rpc('chess_join_room', {p_actor: userId, p_code: code});
      if (error) chessDbError(error);
      return {roomId: data};
    }
    if (body.action !== 'create') throw new ChessError('INVALID_REQUEST');
    const requestId = requireChessId(body.requestId);
    const db = createAdminClient();
    for (let attempt = 0; attempt < 3; attempt++) {
      const {data, error} = await db.rpc('chess_create_room', {
        p_actor: userId, p_request_id: requestId, p_code: chessInviteCode(),
      });
      if (!error) return {roomId: data};
      if (error.code !== '23505') chessDbError(error);
    }
    throw new ChessError('ROOM_CODE_CONFLICT');
  });
}
