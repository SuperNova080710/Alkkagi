import { getChessMatch, resignChessMatch, submitChessMove } from '@/lib/chess/casual';
import { chessBody, ChessError, requireChessId, withChessUser } from '@/lib/chess/http';

type Context = { params: Promise<{id: string}> };

export async function GET(_request: Request, {params}: Context) {
  return withChessUser(async () => getChessMatch(requireChessId((await params).id)));
}

export async function POST(request: Request, {params}: Context) {
  return withChessUser(async userId => {
    const matchId = requireChessId((await params).id);
    const body = await chessBody(request);
    if (body.action === 'move') return submitChessMove(userId, matchId, body);
    if (body.action === 'resign') return resignChessMatch(userId, matchId, requireChessId(body.requestId));
    throw new ChessError('INVALID_REQUEST');
  });
}
