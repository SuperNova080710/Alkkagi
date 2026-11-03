/** Pure request validation for authenticated Omok API endpoints. */
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codeRe = /^[A-HJ-NP-Z2-9]{8}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidRe.test(value);
}

export function normalizeOmokRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().replace(/[\s-]/g, '').toUpperCase();
  return codeRe.test(code) ? code : null;
}

export type ValidMoveRequest = {
  turnNo: number;
  requestId: string;
  row: number;
  col: number;
};
export function parseOmokMoveRequest(value: unknown): ValidMoveRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!Number.isInteger(body.turnNo) || typeof body.turnNo !== 'number' ||
      body.turnNo < 1 || body.turnNo > 225 || !isUuid(body.requestId) ||
      !Number.isInteger(body.row) || typeof body.row !== 'number' ||
      body.row < 0 || body.row > 14 ||
      !Number.isInteger(body.col) || typeof body.col !== 'number' ||
      body.col < 0 || body.col > 14) return null;
  return {
    turnNo: body.turnNo, requestId: body.requestId,
    row: body.row, col: body.col,
  };
}
