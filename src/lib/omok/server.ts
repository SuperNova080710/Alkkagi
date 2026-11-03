import 'server-only';
import { randomInt } from 'node:crypto';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isUuid, normalizeOmokRoomCode, parseOmokMoveRequest } from './validation';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCode = () => Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');

export type OmokAction = 'create' | 'join' | 'room' | 'leave' | 'start' | 'move' | 'forfeit';
export type OmokApiResult = { status: number; body: Record<string, unknown> };

const failure = (status: number, code: string): OmokApiResult => ({ status, body: { error: code } });
const success = (data: unknown): OmokApiResult => ({ status: 200, body: { data } });

function rpcFailure(message: string | undefined): OmokApiResult {
  switch (message) {
    case 'AUTH_REQUIRED': return failure(401, message);
    case 'ROOM_NOT_FOUND':
    case 'MATCH_NOT_FOUND': return failure(404, message);
    case 'INVALID_CODE':
    case 'INVALID_MOVE': return failure(400, message);
    case 'ROOM_UNAVAILABLE':
    case 'ROOM_FULL':
    case 'ROOM_STARTED':
    case 'NEED_TWO_PLAYERS':
    case 'ROOM_LIMIT':
    case 'STALE_TURN':
    case 'NOT_YOUR_TURN':
    case 'CELL_OCCUPIED':
    case 'MATCH_FINISHED':
    case 'DUPLICATE_REQUEST':
    case 'NOT_HOST':
    case 'INVALID_HOST': return failure(409, message);
    default: return failure(503, 'OMOK_UNAVAILABLE');
  }
}

/**
 * For all write operations, the authenticated Supabase RPC owns the authoritative
 * database transaction. The server never accepts a client-supplied board/winner.
 */
export async function executeOmokAction(action: OmokAction, params: Record<string, unknown> = {}): Promise<OmokApiResult> {
  const user = await getVerifiedUser();
  if (!user) return failure(401, 'AUTH_REQUIRED');
  const roomId = params.roomId;
  const matchId = params.matchId;
  if (['room','leave','start'].includes(action) && !isUuid(roomId)) return failure(400,'INVALID_ROOM');
  if (['move','forfeit'].includes(action) && !isUuid(matchId)) return failure(400,'INVALID_MATCH');
  const move = action === 'move' ? parseOmokMoveRequest(params) : null;
  if (action === 'move' && !move) return failure(400,'INVALID_MOVE');
  const invite = action === 'join' ? normalizeOmokRoomCode(params.code) : null;
  if (action === 'join' && !invite) return failure(400,'INVALID_CODE');
  try {
    const db = await createClient();
    if (action === 'create') {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await db.rpc('create_omok_room', { p_code: generateCode() });
        if (!error) return success({ roomId: data });
        if (error.code !== '23505') return rpcFailure(error.message);
      }
      return failure(503,'ROOM_CODE_FAILED');
    }
    const requests = {
      join: ['join_omok_room', { p_code: invite }],
      room: ['get_omok_room', { p_room_id: roomId }],
      leave: ['leave_omok_room', { p_room_id: roomId }],
      start: ['start_omok_match', { p_room_id: roomId }],
      move: ['play_omok_move', {
        p_match_id: matchId, p_turn: move?.turnNo, p_request: move?.requestId,
        p_row: move?.row, p_col: move?.col,
      }],
      forfeit: ['forfeit_omok_match', { p_match_id: matchId }],
    } as const;
    const request = requests[action];
    if (!request) return failure(400,'INVALID_ACTION');
    const { data, error } = await db.rpc(request[0], request[1]);
    if (error) return rpcFailure(error.message);
    return success(action === 'join' ? { roomId: data } :
      action === 'start' ? { matchId: data } : data);
  } catch {
    return failure(503,'OMOK_UNAVAILABLE');
  }
}
