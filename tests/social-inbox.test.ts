import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/app/api/social/inbox/route';
import { parseSocialInbox, unreadMessages } from '../src/components/social/social-inbox';

const { getUser, rpc, adminRpc } = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), adminRpc: vi.fn(),
}));
vi.mock('@/lib/auth/user', () => ({ getVerifiedUser: getUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));

const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const roomId = '44444444-4444-4444-8444-444444444444';
const now = Date.parse('2026-11-16T00:03:00Z');
const invite = {
  id, roomId, inviterId: otherId, inviterNickname: '친구 A',
  createdAt: '2026-11-16T00:00:00Z', expiresAt: '2026-11-16T00:05:00Z',
};

beforeEach(() => {
  getUser.mockResolvedValue({ id: userId });
  rpc.mockResolvedValue({ data: [], error: null });
  adminRpc.mockResolvedValue({ data: [invite], error: null });
  for (const flag of ['FRIENDS', 'MESSAGES', 'ROOM_INVITES', 'OMOK', 'CHESS']) {
    vi.stubEnv(flag + '_UI_ENABLED', 'true');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('shared social inbox', () => {
  it('verifies the recipient once and returns all enabled game sources without caching', async () => {
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.map(([name]) => name).sort()).toEqual([
      'get_direct_message_inbox', 'get_friend_overview', 'list_omok_received_invites', 'list_received_room_invites',
    ]);
    expect(adminRpc).toHaveBeenCalledExactlyOnceWith('chess_list_received_invites', { actor: userId });
    expect(await response.json()).toEqual({
      data: { userId, messages: [], requests: null, invites: { alkkagi: [], omok: [], chess: [invite] } },
    });
  });

  it('performs no list queries for a guest and omits disabled sources', async () => {
    getUser.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();

    vi.stubEnv('OMOK_UI_ENABLED', 'false');
    vi.stubEnv('CHESS_UI_ENABLED', 'false');
    vi.stubEnv('MESSAGES_UI_ENABLED', 'false');
    expect(await (await GET()).json()).toEqual({ data: { userId, requests: null, invites: { alkkagi: [] } } });
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('counts unread messages and keeps other sources available when one game fails', () => {
    const inbox = parseSocialInbox({
      userId, requests: [{ id, userId: otherId, nickname: '친구 A' }],
      messages: [{ threadId: id, userId: otherId, nickname: '친구 A', lastAt: null, lastMessage: null, unreadCount: 2 }],
      invites: {
        alkkagi: [invite],
        omok: [{ ...invite, expiresAt: '2026-11-16T00:02:00Z' }],
        chess: null,
      },
    }, now);
    expect(unreadMessages(inbox)).toBe(2);
    expect(inbox.requests).toHaveLength(1);
    expect(inbox.inviteGames).toEqual(['alkkagi', 'omok', 'chess']);
    expect(inbox.invites).toEqual([{ ...invite, game: 'alkkagi' }]);
    expect(inbox.unavailableGames).toEqual(['chess']);
  });
});
