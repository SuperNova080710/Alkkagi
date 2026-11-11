import { chessBody, chessDbError, ChessError, requireChessId, withChessUser } from '@/lib/chess/http';
import { parseOmokMessage } from '@/lib/omok/http';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Context = { params: Promise<{id: string}> };

export async function GET(_request: Request, {params}: Context) {
  return withChessUser(async () => {
    const matchId = requireChessId((await params).id);
    const db = await createClient();
    const {data,error} = await db.rpc('chess_chat_history',{p_match_id:matchId});
    if (error) chessDbError(error);
    return data;
  });
}

export async function POST(request: Request, {params}: Context) {
  return withChessUser(async userId => {
    const matchId = requireChessId((await params).id);
    const message = parseOmokMessage(await chessBody(request));
    if (!message) throw new ChessError('INVALID_MESSAGE');
    const {data,error} = await createAdminClient().rpc('chess_send_chat_message',{
      p_actor:userId,p_match_id:matchId,p_body:message.body,p_request_id:message.requestId,
    });
    if (error) chessDbError(error);
    return {id:data};
  });
}
