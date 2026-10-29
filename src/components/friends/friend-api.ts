export class FriendApiError extends Error {
  constructor(public status: number, public code: string) { super('Friend request failed'); }
}
export async function friendMutation<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new FriendApiError(response.status, typeof result?.error === 'string' ? result.error : 'UNKNOWN');
  return result?.data as T;
}
export function friendErrorMessage(error: unknown) {
  if (!(error instanceof FriendApiError)) return '요청 결과를 확인하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.';
  if (error.status === 401) return '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  const messages: Record<string, string> = {
    ALREADY_FRIENDS: '이미 친구인 플레이어입니다. 친구 목록을 확인해 주세요.',
    INCOMING_FRIEND_REQUEST: '이 플레이어에게 받은 요청이 있습니다. 친구 화면에서 수락해 주세요.',
    FRIEND_REQUEST_COOLDOWN: '거절된 요청은 24시간이 지난 뒤 다시 보낼 수 있습니다.',
    FRIENDS_FULL: '나 또는 상대방의 친구 목록이 가득 찼습니다.',
    FRIEND_REQUEST_LIMIT: '보낼 수 있는 대기 요청 수를 초과했습니다.',
    FRIEND_INBOX_FULL: '지금은 상대방에게 요청을 보낼 수 없습니다. 나중에 다시 시도해 주세요.',
    BLOCK_LIMIT: '차단 목록이 가득 찼습니다.',
    FRIEND_NOT_AVAILABLE: '지금은 이 플레이어에게 요청할 수 없습니다.',
    FRIEND_REQUEST_NOT_FOUND: '처리할 요청을 찾을 수 없습니다. 목록을 새로고침해 주세요.',
  };
  if (messages[error.code]) return messages[error.code];
  if (error.status === 503) return '친구 기능을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (error.status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  return '요청을 처리하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.';
}
export type FriendAction = { kind: 'accept' | 'reject' | 'remove' | 'block' | 'unblock'; id: string; nickname: string };
export function friendActionRequest(action: FriendAction): { path: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown } {
  const id = encodeURIComponent(action.id);
  switch (action.kind) {
    case 'accept': case 'reject': return { path: `/api/friends/requests/${id}/respond`, method: 'POST', body: { accept: action.kind === 'accept' } };
    case 'remove': return { path: `/api/friends/${id}`, method: 'DELETE' };
    default: return { path: `/api/friends/blocks/${id}`, method: 'PUT', body: { blocked: action.kind === 'block' } };
  }
}
