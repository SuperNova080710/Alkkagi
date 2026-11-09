import { chessBody, chessDbError, ChessError, requireChessId, withChessUser } from '@/lib/chess/http';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Context = { params: Promise<{id: string}> };

export async function GET(_request: Request, {params}: Context) {
  return withChessUser(async () => {
    const id = requireChessId((await params).id);
    const db = await createClient();
    const {data, error} = await db.rpc('chess_room_snapshot', {p_room_id: id});
    if (error) chessDbError(error);
    if (!data) throw new ChessError('ROOM_NOT_FOUND');
    return data;
  });
}

export async function POST(request: Request, {params}: Context) {
  return withChessUser(async userId => {
    const id = requireChessId((await params).id);
    const {action} = await chessBody(request);
    if (action !== 'start' && action !== 'leave') throw new ChessError('INVALID_REQUEST');
    const {data, error} = await createAdminClient().rpc(
      action === 'start' ? 'chess_start_match' : 'chess_leave_room', {p_actor: userId, p_room_id: id},
    );
    if (error) chessDbError(error);
    return action === 'start' ? {matchId: data} : {left: true};
  });
}
