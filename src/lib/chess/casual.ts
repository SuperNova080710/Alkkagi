import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { initialChessState, parseChessMove, playChessMove, type ChessMove } from './engine';
import { chessDbError, ChessError, requireChessId } from './http';

type StoredMove = {
  ply: number;
  player_id: string;
  request_id: string;
  from_square: ChessMove['from'];
  to_square: ChessMove['to'];
  promotion: NonNullable<ChessMove['promotion']> | null;
  san: string;
};

type StoredSnapshot = {
  match: {
    id: string;
    room_id: string | null;
    mode?: 'casual' | 'ranked';
    turn_deadline?: string | null;
    white_id: string;
    black_id: string;
    ply: number;
    fen: string;
    in_check: boolean;
    winner_id: string | null;
    finish_reason: string | null;
    finished_at: string | null;
  };
  moves: StoredMove[];
};

async function loadChessMatch(matchId: string): Promise<StoredSnapshot> {
  const db = await createClient();
  const {data, error} = await db.rpc('chess_match_snapshot', {p_match_id: matchId});
  if (error) chessDbError(error);
  if (!data) throw new ChessError('MATCH_NOT_FOUND');
  return data as StoredSnapshot;
}

function publicMatch({ match, moves }: StoredSnapshot) {
  return {
    id: match.id, roomId: match.room_id, whiteId: match.white_id, blackId: match.black_id,
    status: match.finished_at ? 'finished' : 'active',
    mode: match.mode ?? 'casual', deadline: match.turn_deadline ?? null,
    ply: match.ply, fen: match.fen, inCheck: match.in_check,
    turnUserId: match.finished_at ? null : match.ply % 2 === 0 ? match.white_id : match.black_id,
    winnerId: match.winner_id, finishReason: match.finish_reason, finishedAt: match.finished_at,
    moves: moves.map(move => ({
      ply: move.ply, playerId: move.player_id, from: move.from_square,
      to: move.to_square, promotion: move.promotion, san: move.san,
    })),
  };
}

export async function getChessMatch(matchId: string) {
  return publicMatch(await loadChessMatch(matchId));
}

export async function submitChessMove(userId: string, matchId: string, body: Record<string, unknown>) {
  const requestId = requireChessId(body.requestId);
  const move = parseChessMove(body);
  const ply = body.ply;
  if (!move || typeof ply !== 'number' || !Number.isInteger(ply) || ply < 0 || ply >= 2_147_483_647)
    throw new ChessError('INVALID_MOVE');

  const snapshot = await loadChessMatch(matchId);
  const { match, moves } = snapshot;
  const previous = moves.find(entry => entry.request_id === requestId);
  if (previous) {
    if (previous.player_id !== userId || previous.ply !== ply + 1 || previous.from_square !== move.from ||
        previous.to_square !== move.to || previous.promotion !== (move.promotion ?? null))
      throw new ChessError('REQUEST_CONFLICT');
    return publicMatch(snapshot);
  }

  if (match.finished_at) throw new ChessError('MATCH_FINISHED');
  if (match.ply !== ply) throw new ChessError('STALE_TURN');
  if (userId !== (ply % 2 === 0 ? match.white_id : match.black_id)) throw new ChessError('NOT_YOUR_TURN');

  const result = playChessMove({
    ...initialChessState(),
    moves: moves.map(entry => ({
      from: entry.from_square, to: entry.to_square,
      ...(entry.promotion ? {promotion: entry.promotion} : {}),
    })),
  }, move);
  if (!result.ok) throw new ChessError(result.reason === 'game-finished' ? 'MATCH_FINISHED' : 'INVALID_MOVE');

  const {error} = await createAdminClient().rpc('chess_commit_move', {
    p_actor: userId, p_match_id: matchId, p_request_id: requestId, p_expected_ply: ply,
    p_from: move.from, p_to: move.to, p_promotion: move.promotion ?? null,
    p_san: result.san, p_fen: result.position.fen, p_in_check: result.position.inCheck,
    p_finish_reason: result.position.outcome?.reason ?? null,
  });
  if (error) chessDbError(error);
  return getChessMatch(matchId);
}

export async function resignChessMatch(userId: string, matchId: string, requestId: string) {
  const {error} = await createAdminClient().rpc('chess_resign', {
    p_actor: userId, p_match_id: matchId, p_request_id: requestId,
  });
  if (error) chessDbError(error);
  return getChessMatch(matchId);
}

export async function expireChessRanked(userId: string, matchId: string) {
  const {error} = await createAdminClient().rpc('chess_expire_ranked', {
    p_actor: userId, p_match_id: matchId,
  });
  if (error) chessDbError(error);
  return getChessMatch(matchId);
}
