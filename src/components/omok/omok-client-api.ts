import type { OmokBoardCells, OmokPosition, OmokStone } from './omok-board-view';
import { isOmokBoardCells } from './omok-board-view';

export class OmokClientError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'OmokClientError';
  }
}
export function omokErrorText(error: unknown): string {
  const code = error instanceof OmokClientError ? error.code : 'NETWORK_ERROR';
  const labels: Record<string, string> = {
    AUTH_REQUIRED: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
    INVALID_CODE: '방 코드는 영문·숫자 8자리입니다.',
    ROOM_NOT_FOUND: '참가할 수 없는 방입니다. 코드를 다시 확인해 주세요.',
    MATCH_NOT_FOUND: '접근 권한이 없거나 존재하지 않는 대국입니다.',
    ROOM_FULL: '이미 두 명이 참가한 방입니다.',
    ROOM_UNAVAILABLE: '입장 가능한 대기실이 아닙니다.',
    ROOM_NOT_AVAILABLE: '초대할 수 없는 대기실입니다.',
    NEED_TWO_PLAYERS: '두 명이 입장해야 시작할 수 있습니다.',
    NOT_HOST: '방장만 경기를 시작할 수 있습니다.',
    NOT_YOUR_TURN: '현재 착수할 차례가 아닙니다.',
    STALE_TURN: '경기 상태가 바뀌었습니다. 최신 대국을 다시 확인해 주세요.',
    CELL_OCCUPIED: '이미 돌이 놓인 자리입니다.',
    MATCH_FINISHED: '이미 종료된 경기입니다.',
    REQUEST_CONFLICT: '이 요청은 다른 좌표로 재사용할 수 없습니다.',
    CHAT_RATE_LIMIT: '메시지를 너무 빠르게 보냈습니다. 잠시 후 다시 시도해 주세요.',
    INVALID_MESSAGE: '메시지는 1~280자로 입력해 주세요.',
    CHAT_CLOSED: '이 경기의 채팅이 종료되었습니다.',
    FRIEND_NOT_AVAILABLE: '초대할 수 없는 친구입니다.',
    ROOM_INVITE_RATE_LIMIT: '초대 발송 제한에 도달했습니다.',
    ROOM_INVITE_NOT_FOUND: '초대가 만료되었거나 이미 처리되었습니다.',
    ACTIVE_CASUAL_MATCH: '진행 중인 오목 일반전이 있습니다.',
    GAME_SERVICE_UNAVAILABLE: '오목 서버 또는 데이터베이스가 준비되지 않았습니다. 나중에 다시 확인해 주세요.',
    NETWORK_ERROR: '연결을 확인하지 못했습니다. 요청 결과를 확인하거나 같은 요청을 재시도해 주세요.',
    MALFORMED_RESPONSE: '서버 응답 형식이 올바르지 않습니다. 새로고침해 주세요.',
  };
  return labels[code] ?? '요청을 처리하지 못했습니다. 최신 상태를 다시 확인해 주세요. (' + code + ')';
}
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export async function omokRequest<T>(url: string, options: {
  method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal;
} = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'same-origin', cache: 'no-store', signal: options.signal,
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new OmokClientError('NETWORK_ERROR', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error : response.status === 401 ? 'AUTH_REQUIRED' : 'GAME_SERVICE_UNAVAILABLE';
    throw new OmokClientError(code, response.status);
  }
  if (!isRecord(payload)) throw new OmokClientError('MALFORMED_RESPONSE', response.status);
  return payload.data as T;
}

export type RoomSnapshot = {
  id: string; code: string; status: 'waiting' | 'playing' | 'closed';
  yourSeat: 1 | 2; matchId: string | null;
  players: { userId: string; nickname: string; seat: 1 | 2 }[];
};
export function parseRoom(data: unknown): RoomSnapshot {
  if (!isRecord(data) || !isUuid(data.id) || typeof data.code !== 'string' ||
    !['waiting','playing','closed'].includes(String(data.status)) ||
    ![1,2].includes(Number(data.yourSeat)) ||
    !Array.isArray(data.players)) throw new OmokClientError('MALFORMED_RESPONSE', 200);
  const players = data.players.map(p => {
    if (!isRecord(p) || !isUuid(p.userId) || typeof p.nickname !== 'string' ||
      (p.seat !== 1 && p.seat !== 2)) throw new OmokClientError('MALFORMED_RESPONSE', 200);
    return { userId: p.userId, nickname: p.nickname, seat: p.seat as 1 | 2 };
  });
  return {
    id: data.id, code: data.code,
    status: data.status as RoomSnapshot['status'],
    yourSeat: data.yourSeat as 1 | 2,
    matchId: isUuid(data.matchId) ? data.matchId : null,
    players,
  };
}
export type MatchSnapshot = {
  id: string; roomId: string | null; mode: 'casual' | 'ranked';
  blackId: string; whiteId: string; turnUserId: string;
  turnNo: number; board: OmokBoardCells; status: 'active' | 'finished';
  winnerId: string | null; finishReason: string | null; lastMove: OmokPosition | null;
  turnDeadline: string | null;
};
export function parseMatch(data: unknown): MatchSnapshot {
  if (!isRecord(data) || !isRecord(data.match) || !Array.isArray(data.moves))
    throw new OmokClientError('MALFORMED_RESPONSE', 200);
  const m = data.match;
  if (!isUuid(m.id) || !isUuid(m.black_id) || !isUuid(m.white_id) ||
    !isUuid(m.turn_user_id) || !isOmokBoardCells(m.board_state) ||
    (m.status !== 'active' && m.status !== 'finished') ||
    typeof m.turn_no !== 'number' || !Number.isInteger(m.turn_no))
    throw new OmokClientError('MALFORMED_RESPONSE', 200);
  const last = data.moves.at(-1) as unknown;
  const lastMove = isRecord(last) && Number.isInteger(last.row_no) &&
    Number.isInteger(last.col_no) && Number(last.row_no) >= 0 &&
    Number(last.row_no) <= 14 && Number(last.col_no) >= 0 && Number(last.col_no) <= 14
    ? { row: Number(last.row_no), col: Number(last.col_no) } : null;
  return {
    id: m.id, roomId: isUuid(m.room_id) ? m.room_id : null,
    mode: m.mode === 'ranked' ? 'ranked' : 'casual',
    blackId: m.black_id, whiteId: m.white_id, turnUserId: m.turn_user_id,
    turnNo: m.turn_no, board: m.board_state as OmokBoardCells,
    status: m.status, winnerId: isUuid(m.winner_id) ? m.winner_id : null,
    finishReason: typeof m.finish_reason === 'string' ? m.finish_reason : null,
    lastMove, turnDeadline: typeof m.turn_deadline === 'string' ? m.turn_deadline : null,
  };
}
export type OmokChatRecord = {
  id: string; sender_id: string; body: string; created_at: string;
};
export function parseMessages(value: unknown): OmokChatRecord[] {
  if (!Array.isArray(value)) throw new OmokClientError('MALFORMED_RESPONSE', 200);
  return value.filter(isRecord).filter(m =>
    isUuid(m.id) && isUuid(m.sender_id) && typeof m.body === 'string' &&
    typeof m.created_at === 'string').map(m => ({
      id: m.id as string, sender_id: m.sender_id as string,
      body: m.body as string, created_at: m.created_at as string,
    }));
}
export function participant(id: string, nickname: string, stone: OmokStone) {
  return { id, nickname, stone };
}
