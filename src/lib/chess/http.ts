import 'server-only';
import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';

const noStore = { 'Cache-Control': 'no-store' };
const statuses = {
  CHESS_DISABLED: 404, AUTH_REQUIRED: 401, INVALID_REQUEST: 400,
  INVALID_CODE: 400, INVALID_MOVE: 422, ROOM_NOT_FOUND: 404, MATCH_NOT_FOUND: 404,
  ROOM_CLOSED: 409, ROOM_FULL: 409, NEED_TWO_PLAYERS: 409, MATCH_ALREADY_STARTED: 409,
  ROOM_CODE_CONFLICT: 409, NOT_HOST: 403, PROFILE_MISSING: 403, MATCH_FINISHED: 409,
  REMATCH_NOT_AVAILABLE: 409, REMATCH_EXPIRED: 409,
  TURN_EXPIRED: 409, NOT_YOUR_TURN: 409, STALE_TURN: 409, REQUEST_CONFLICT: 409,
  ROOM_ACTIVE_LIMIT: 429, ROOM_RATE_LIMIT: 429, GAME_SERVICE_UNAVAILABLE: 503,
  INVALID_MESSAGE: 400, CHAT_NOT_AVAILABLE: 403, CHAT_CLOSED: 409, CHAT_FULL: 409, CHAT_RATE_LIMIT: 429,
} as const;

type ChessErrorCode = keyof typeof statuses;

export class ChessError extends Error {
  constructor(readonly code: ChessErrorCode) {
    super(code);
  }
}

export function requireChessId(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 36 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new ChessError('INVALID_REQUEST');
  return value.toLowerCase();
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function chessInviteCode() {
  return Array.from({length: 8}, () => alphabet[randomInt(alphabet.length)]).join('');
}

export function normalizeChessInvite(value: unknown) {
  const code = typeof value === 'string' ? value.trim().replace(/[\s-]/g, '').toUpperCase() : '';
  if (code.length !== 8 || !/^[A-HJ-NP-Z2-9]{8}$/.test(code)) throw new ChessError('INVALID_CODE');
  return code;
}

export async function chessBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json')
    throw new ChessError('INVALID_REQUEST');
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ChessError('INVALID_REQUEST');
  return body as Record<string, unknown>;
}

export function chessDbError(error: {message: string}): never {
  const code = error.message;
  if (Object.hasOwn(statuses, code)) throw new ChessError(code as ChessErrorCode);
  throw new ChessError('GAME_SERVICE_UNAVAILABLE');
}

export async function withChessUser(handler: (userId: string) => Promise<unknown>) {
  try {
    if (process.env.CHESS_UI_ENABLED !== 'true') throw new ChessError('CHESS_DISABLED');
    const user = await getVerifiedUser();
    if (!user) throw new ChessError('AUTH_REQUIRED');
    const data = await handler(user.id);
    return NextResponse.json({data}, {headers: noStore});
  } catch (cause) {
    const code = cause instanceof ChessError ? cause.code : 'GAME_SERVICE_UNAVAILABLE';
    return NextResponse.json({error: code}, {status: statuses[code], headers: noStore});
  }
}
