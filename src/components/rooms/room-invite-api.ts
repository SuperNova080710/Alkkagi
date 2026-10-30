export type ReceivedRoomInvite = {
  id: string;
  roomId: string;
  inviterId: string;
  inviterNickname: string;
  createdAt: string;
  expiresAt: string;
};
export type SentRoomInvite = {
  id: string;
  inviteeId: string;
  inviteeNickname: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
};
export type RoomInviteSent = {
  inviteId: string; status: 'pending'; expiresAt: string; alreadyPending: boolean;
};
export type RoomInviteResponded = {
  inviteId: string; status: 'accepted' | 'declined'; roomId: string | null;
};
export type InviteFriend = { id: string; nickname: string };
export type InviteFriends = { friends: InviteFriend[] };

export class RoomInviteError extends Error {
  constructor(public status: number, public code: string) { super('Room invite request failed'); }
}

export function isRoomUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
/** Untrusted HTTP 200 JSON: validate every nested record before rendering. */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isInviteDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 &&
    Number.isFinite(Date.parse(value));
}
export function isInviteFriend(value: unknown): value is InviteFriend {
  return isObject(value) && isRoomUuid(value.id) && typeof value.nickname === 'string';
}
export function isReceivedRoomInvite(value: unknown): value is ReceivedRoomInvite {
  return isObject(value) &&
    isRoomUuid(value.id) && isRoomUuid(value.roomId) && isRoomUuid(value.inviterId) &&
    typeof value.inviterNickname === 'string' &&
    isInviteDate(value.createdAt) && isInviteDate(value.expiresAt);
}
export function isSentRoomInvite(value: unknown): value is SentRoomInvite {
  return isObject(value) &&
    isRoomUuid(value.id) && isRoomUuid(value.inviteeId) &&
    (typeof value.inviteeNickname === 'string' || value.inviteeNickname === null) &&
    (value.status === 'pending' || value.status === 'accepted' ||
      value.status === 'declined' || value.status === 'expired') &&
    isInviteDate(value.createdAt) && isInviteDate(value.expiresAt);
}
export function validInviteFriends(value: unknown): InviteFriend[] {
  return isObject(value) && Array.isArray(value.friends)
    ? value.friends.filter(isInviteFriend) : [];
}
export function validReceivedRoomInvites(value: unknown): ReceivedRoomInvite[] {
  return Array.isArray(value) ? value.filter(isReceivedRoomInvite) : [];
}
export function validSentRoomInvites(value: unknown): SentRoomInvite[] {
  return Array.isArray(value) ? value.filter(isSentRoomInvite) : [];
}

export function roomInviteError(error: unknown): string {
  if (!(error instanceof RoomInviteError)) return '연결 상태를 확인할 수 없습니다. 목록을 새로고침해 주세요.';
  const errors: Record<string, string> = {
    AUTH_REQUIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    ORIGIN_NOT_ALLOWED: '요청 출처를 확인하지 못했습니다. 페이지를 새로고침해 주세요.',
    INVALID_REQUEST: '초대 정보를 확인할 수 없습니다.',
    INVALID_ROOM_INVITE: '초대 정보를 확인할 수 없습니다.',
    ROOM_NOT_AVAILABLE: '초대할 수 없는 방입니다. 방 상태를 다시 확인해 주세요.',
    FRIEND_NOT_AVAILABLE: '현재 초대할 수 없는 친구입니다. 친구 상태를 확인해 주세요.',
    ROOM_INVITE_NOT_FOUND: '초대가 만료되었거나 수락할 수 없습니다. 목록을 다시 확인해 주세요.',
    ROOM_INVITE_ALREADY_SENT: '이 방에서는 다시 초대할 수 없습니다.',
    ROOM_INVITE_RATE_LIMIT: '잠시 동안 보낼 수 있는 초대 횟수를 초과했습니다.',
    ROOM_INVITE_INBOX_FULL: '상대방이 받을 수 있는 초대 수를 초과했습니다.',
    ROOM_INVITE_SERVICE_UNAVAILABLE: '친구 초대 기능을 이용할 수 없습니다. 운영 준비 상태를 확인해 주세요.',
  };
  if (Object.prototype.hasOwnProperty.call(errors, error.code)) return errors[error.code];
  if (error.status === 401) return errors.AUTH_REQUIRED;
  if (error.status === 404) return errors.ROOM_INVITE_NOT_FOUND;
  if (error.status === 429) return errors.ROOM_INVITE_RATE_LIMIT;
  if (error.status === 503) return errors.ROOM_INVITE_SERVICE_UNAVAILABLE;
  return '초대를 처리하지 못했습니다. 최신 목록을 확인한 뒤 다시 시도해 주세요.';
}

export async function roomInviteRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok) throw new RoomInviteError(response.status,
    typeof result?.error === 'string' ? result.error : 'UNKNOWN');
  if (!result || !Object.prototype.hasOwnProperty.call(result, 'data'))
    throw new RoomInviteError(503, 'ROOM_INVITE_SERVICE_UNAVAILABLE');
  return result.data as T;
}

export function roomInviteMutation<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return roomInviteRequest<T>(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
export function inviteTime(iso: string): string {
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime()) ? '만료 시각 확인 필요'
    : timestamp.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
