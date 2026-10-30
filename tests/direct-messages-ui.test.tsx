import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DmApiError, canSendDm, dmBodyLength, dmConversationPath, dmErrorMessage,
  dmMutation, dmRequest, isDmPeerId, normalizedDmBody,
} from '../src/components/messages/message-api';
import { MessengerView } from '../src/components/messages/messenger-view';
import { FriendsView } from '../src/components/friends/friends-view';
import MessagesPage from '../src/app/messages/page';

const { auth } = vi.hoisted(() => ({ auth: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })) }));
vi.mock('@/lib/auth/user', () => ({ requireUser: auth }));
const peer = '22222222-2222-4222-8222-222222222222';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('friend messenger V1 UI contract', () => {
  it('fails closed while both operational flags are not explicitly enabled', async () => {
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('MESSAGES_UI_ENABLED', '');
    const html = renderToStaticMarkup(await MessagesPage({ searchParams: Promise.resolve({ peer }) }));
    expect(html).toContain('메신저 준비 중');
    expect(html).not.toContain('친구와 대화');
    expect(html).toContain('href="/friends"');
    expect(auth).toHaveBeenCalledOnce();
    vi.stubEnv('MESSAGES_UI_ENABLED', 'true');
    vi.stubEnv('FRIENDS_UI_ENABLED', '');
    const disabled = renderToStaticMarkup(await MessagesPage({ searchParams: Promise.resolve({}) }));
    expect(disabled).toContain('메신저 준비 중');
  });

  it('only mounts the inbox client UI when both flags are enabled', async () => {
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('MESSAGES_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(await MessagesPage({ searchParams: Promise.resolve({ peer }) }));
    expect(html).toContain('친구와 대화');
    expect(html).toContain('친구 전용 1:1 메시지');
    expect(html).not.toContain('메신저 준비 중');
    expect(html).toContain('href="/friends"');
    expect(html).toContain('role="status"');
  });

  it('does not expose a write action for malformed peer IDs', async () => {
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('MESSAGES_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(await MessagesPage({
      searchParams: Promise.resolve({ peer: '../api/admin' }),
    }));
    expect(html).toContain('친구를 선택해 주세요');
    expect(html).not.toContain('메시지 입력');
    expect(isDmPeerId(peer)).toBe(true);
    expect(isDmPeerId('not-a-uuid')).toBe(false);
    expect(dmConversationPath(peer)).toBe('/messages?peer=' + peer);
  });

  it('keeps friend navigation hidden by default and exposes it on explicit enablement', () => {
    const hidden = renderToStaticMarkup(<FriendsView />);
    expect(hidden).not.toContain('href="/messages"');
    const enabled = renderToStaticMarkup(<FriendsView messagesEnabled />);
    expect(enabled).toContain('href="/messages"');
    expect(enabled).not.toContain('친구 (0)');
    const welcome = renderToStaticMarkup(<MessengerView userId="me" initialPeer={null}/>);
    expect(welcome).toContain('친구를 선택해 주세요');
    expect(welcome).not.toContain('아직 대화할 친구가 없습니다');
  });

  it('measures 500 Unicode codepoints after trim without number coercion', () => {
    expect(normalizedDmBody(' \n안녕\t')).toBe('안녕');
    expect(canSendDm('\n\t')).toBe(false);
    expect(canSendDm('💬'.repeat(500))).toBe(true);
    expect(dmBodyLength('💬'.repeat(500))).toBe(500);
    expect(canSendDm('💬'.repeat(501))).toBe(false);
    expect(canSendDm('a\0b')).toBe(false);
    expect(canSendDm('  안녕하세요  ')).toBe(true);
  });

  it('uses safe HTTP error messages and never exposes raw server exceptions', () => {
    expect(dmErrorMessage(new DmApiError(404, 'DM_NOT_AVAILABLE'))).toContain('친구');
    expect(dmErrorMessage(new DmApiError(429, 'DM_RATE_LIMIT'))).toContain('1초');
    expect(dmErrorMessage(new DmApiError(401, 'AUTH_REQUIRED'))).toContain('로그인');
    expect(dmErrorMessage(new DmApiError(503, 'confidential SQL detail'))).not.toContain('confidential');
  });

  it('keeps bigint cursors as strings and same-origin JSON mutations', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { threadId: null, messages: [], hasMore: false } }),
    });
    vi.stubGlobal('fetch', fetcher);
    const cursor = '9007199254740993123';
    await dmRequest('/api/messages/' + peer + '?before=' + cursor);
    expect(fetcher).toHaveBeenCalledWith('/api/messages/' + peer + '?before=' + cursor,
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
    await dmMutation('/api/messages/' + peer + '/read', 'PUT', { messageId: cursor });
    expect(fetcher).toHaveBeenLastCalledWith('/api/messages/' + peer + '/read',
      expect.objectContaining({
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: cursor }),
      }));
  });

  it('returns masked error when the server sends non-JSON failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, json: async () => { throw new Error('backend error'); },
    }));
    await expect(dmRequest('/api/messages')).rejects.toMatchObject({ status: 503, code: 'UNKNOWN' });
  });
});
