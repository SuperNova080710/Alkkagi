import { chessBody, ChessError, withChessUser } from '@/lib/chess/http';
import { chessRankedQueue } from '@/lib/chess/ranked';

export async function GET() {
  return withChessUser(userId => chessRankedQueue(userId, 'status'));
}
export async function POST(request: Request) {
  return withChessUser(async userId => {
    const {action} = await chessBody(request);
    if (action !== 'join' && action !== 'cancel') throw new ChessError('INVALID_REQUEST');
    return chessRankedQueue(userId, action);
  });
}
