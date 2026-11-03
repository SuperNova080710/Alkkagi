import { randomInt } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export type OmokMoveInput = { requestId: string; turnNo: number; row: number; col: number };

export function isOmokUuid(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}

export function normalizeOmokInvite(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().replace(/[\s-]/g, '').toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null;
}

export function createOmokInviteCode(): string {
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export function parseOmokMove(value: unknown): OmokMoveInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!isOmokUuid(input.requestId) || typeof input.turnNo !== 'number' ||
    !Number.isInteger(input.turnNo) || input.turnNo < 1 || input.turnNo > 225 ||
    typeof input.row !== 'number' || !Number.isInteger(input.row) ||
    typeof input.col !== 'number' || !Number.isInteger(input.col) ||
    input.row < 0 || input.row >= 15 || input.col < 0 || input.col >= 15) return null;
  return { requestId: input.requestId, turnNo: input.turnNo, row: input.row, col: input.col };
}

const statusByReason: Record<string, number> = {
  INVALID_CODE: 400, INVALID_MOVE: 400, INVALID_REQUEST: 400,
  ROOM_NOT_FOUND: 404, MATCH_NOT_FOUND: 404,
  ROOM_FULL: 409, ROOM_UNAVAILABLE: 409, MATCH_ALREADY_STARTED: 409,
  MATCH_FINISHED: 409, ROOM_STARTED: 409, NEED_TWO_PLAYERS: 409,
  NOT_HOST: 403, NOT_YOUR_TURN: 409, STALE_TURN: 409,
  CELL_OCCUPIED: 409, REQUEST_CONFLICT: 409,
  ROOM_ACTIVE_LIMIT: 429, ROOM_RATE_LIMIT: 429,
  PROFILE_MISSING: 403, INVALID_HOST_SEAT: 403,
};

export function omokRpcError(error: { message?: string } | null): { error: string; status: number } {
  const reason = error?.message ?? '';
  const found = Object.keys(statusByReason).find(key => reason === key || reason.includes(' ' + key));
  return found ? { error: found, status: statusByReason[found] } :
    { error: 'GAME_SERVICE_UNAVAILABLE', status: 503 };
}
