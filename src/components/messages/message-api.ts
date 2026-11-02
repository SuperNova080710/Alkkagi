/** UI-only adapter for the already deployed-in-code /api/messages contract. */
export type DmPeer = { id: string; nickname: string };
export type DmInboxItem = {
  threadId: string;
  userId: string;
  nickname: string;
  lastAt: string | null;
  lastMessage: DmMessage | null;
  unreadCount: number;
};
export type DmMessage = { id: string; senderId: string; body: string; createdAt: string };
export type DmHistory = { threadId: string | null; messages: DmMessage[]; hasMore: boolean };
export type DmFriends = { friends: DmPeer[] };
export type DmSent = DmMessage & { threadId: string; alreadySent: boolean };

export class DmApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super('Direct messages request failed');
  }
}

export const isDmPeerId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// HTTP 200 is not a runtime type guarantee. SQL returns lastMessage as an
// OBJECT (or null), not a string. Validate all nested records before React uses
// .map(), .find(), string interpolation or pagination.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && isDmPeerId(value);
const decimalId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

export function isDmPeer(value: unknown): value is DmPeer {
  return isRecord(value) && uuid(value.id) && typeof value.nickname === 'string';
}
export function isDmFriends(value: unknown): value is DmFriends {
  return isRecord(value) && Array.isArray(value.friends) && value.friends.every(isDmPeer);
}
export function isDmMessage(value: unknown): value is DmMessage {
  return isRecord(value) && decimalId(value.id) && uuid(value.senderId) &&
    typeof value.body === 'string' && timestamp(value.createdAt);
}
export function isDmInbox(value: unknown): value is DmInboxItem[] {
  return Array.isArray(value) && value.every(item => isRecord(item) &&
    uuid(item.threadId) && uuid(item.userId) && typeof item.nickname === 'string' &&
    (item.lastAt === null || timestamp(item.lastAt)) &&
    (item.lastMessage === null || isDmMessage(item.lastMessage)) &&
    (item.lastMessage === null || item.lastAt !== null) &&
    typeof item.unreadCount === 'number' && Number.isSafeInteger(item.unreadCount) && item.unreadCount >= 0);
}
export function isDmHistory(value: unknown): value is DmHistory {
  return isRecord(value) && (value.threadId === null || uuid(value.threadId)) &&
    Array.isArray(value.messages) && value.messages.every(isDmMessage) &&
    typeof value.hasMore === 'boolean' &&
    (value.threadId !== null || (value.messages.length === 0 && value.hasMore === false));
}
export function isDmSent(value: unknown): value is DmSent {
  if (!isDmMessage(value)) return false;
  const sent = value as DmMessage & { threadId?: unknown; alreadySent?: unknown };
  return uuid(sent.threadId) && typeof sent.alreadySent === 'boolean';
}
export async function dmValidatedRequest<T>(
  path: string, valid: (value: unknown) => value is T, options: RequestInit = {},
): Promise<T> {
  const value = await dmRequest<unknown>(path, options);
  if (!valid(value)) throw new DmApiError(503, 'DM_SERVICE_UNAVAILABLE');
  return value;
}

export const normalizedDmBody = (value: string) => value.trim();
export const dmBodyLength = (value: string) => Array.from(normalizedDmBody(value)).length;
export const canSendDm = (value: string) => {
  const text = normalizedDmBody(value);
  const length = dmBodyLength(value);
  return length > 0 && length <= 500 && !text.includes('\0');
};

export async function dmRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok) throw new DmApiError(response.status,
    typeof result?.error === 'string' ? result.error : 'UNKNOWN');
  if (result == null || !Object.prototype.hasOwnProperty.call(result, 'data'))
    throw new DmApiError(503, 'DM_SERVICE_UNAVAILABLE');
  return result.data as T;
}

export function dmMutation<T>(path: string, method: 'POST' | 'PUT', body: object): Promise<T> {
  return dmRequest<T>(path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export function dmErrorMessage(reason: unknown): string {
  if (!(reason instanceof DmApiError)) return '연결 상태를 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.';
  if (reason.status === 401) return '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  if (reason.status === 404 || reason.code === 'DM_NOT_AVAILABLE')
    return '대화할 수 없는 친구입니다. 친구 관계 또는 차단 상태를 확인해 주세요.';
  const known: Record<string, string> = {
    DM_RATE_LIMIT: '메시지는 1초 간격으로 전송할 수 있습니다. 잠시 뒤 다시 시도해 주세요.',
    DM_DAILY_LIMIT: '오늘 보낼 수 있는 메시지 수에 도달했습니다.',
    DM_THREAD_FULL: '이 대화의 메시지 저장 한도에 도달했습니다.',
    DM_INVALID_MESSAGE: '메시지는 공백을 제외한 1~500자까지 입력할 수 있습니다.',
    DM_INVALID_MESSAGE_ID: '읽음 표시 대상을 확인할 수 없습니다. 대화를 새로고침해 주세요.',
    DM_INVALID_PAGE: '이전 메시지를 불러올 수 없습니다. 다시 시도해 주세요.',
  };
  if (known[reason.code]) return known[reason.code];
  if (reason.status === 429) return '메시지 전송이 제한되었습니다. 잠시 뒤 다시 시도해 주세요.';
  if (reason.status === 503) return '메신저를 이용할 수 없습니다. 서비스 준비 상태를 확인해 주세요.';
  return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}

export function dmConversationPath(peerId: string): string {
  return '/messages?peer=' + encodeURIComponent(peerId);
}
