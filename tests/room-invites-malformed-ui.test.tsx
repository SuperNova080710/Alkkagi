import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { resource } = vi.hoisted(() => ({ resource: vi.fn() }));
vi.mock('@/components/players/use-player-resource', () => ({ usePlayerResource: resource }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { SendFriendRoomInvite } from '../src/components/rooms/send-friend-room-invite';
import { ReceivedRoomInvites } from '../src/components/rooms/received-room-invites';
import {
  isInviteFriend, isReceivedRoomInvite, isSentRoomInvite,
  validInviteFriends, validReceivedRoomInvites, validSentRoomInvites,
} from '../src/components/rooms/room-invite-api';

const roomId = '22222222-2222-4222-8222-222222222222';
const friendId = '33333333-3333-4333-8333-333333333333';
const inviteId = '44444444-4444-4444-8444-444444444444';
const createdAt = '2026-10-30T03:00:00Z';
const expiresAt = '2026-10-30T03:05:00Z';
const friend = { id: friendId, nickname: '친구 A' };
const received = {
  id: inviteId, roomId, inviterId: friendId, inviterNickname: '초대한 친구',
  createdAt, expiresAt,
};
const sent = {
  id: inviteId, inviteeId: friendId, inviteeNickname: '초대한 친구', status: 'pending',
  createdAt, expiresAt,
};

function mockResource(friends: unknown, sentInvites: unknown, receivedInvites: unknown) {
  resource.mockImplementation((path: string) => ({
    data: path === '/api/friends' ? friends :
      path.startsWith('/api/room-invites/sent?') ? sentInvites : receivedInvites,
    error: undefined, loading: false, retry: vi.fn(),
  }));
}
afterEach(() => { resource.mockReset(); vi.clearAllMocks(); });

describe('malformed HTTP 200 invitation data cannot crash the UI', () => {
  it('guards friend ids, names and null entries before creating selectable options', () => {
    const badFriends: unknown = { friends: [
      null, { id: null, nickname: 'invalid' }, { id: friendId, nickname: { bad: true } },
      { id: 'not-uuid', nickname: 'wrong id' }, friend,
    ] };
    expect(isInviteFriend(null)).toBe(false);
    expect(isInviteFriend({ id: friendId, nickname: {} })).toBe(false);
    expect(validInviteFriends(badFriends)).toEqual([friend]);
    mockResource(badFriends, [], []);
    const html = renderToStaticMarkup(<SendFriendRoomInvite roomId={roomId}/>);
    expect(html).toContain('친구 A');
    expect(html).toContain('value="' + friendId + '"');
    expect(html).not.toContain('invalid');
    expect(html).not.toContain('wrong id');
    expect(html).not.toContain('[object Object]');
  });

  it('renders empty safe friend state for friends:[null] or missing friends array', () => {
    for (const bad of [{ friends: [null] }, { friends: [{ id: null }] }, { friends: null }, null]) {
      mockResource(bad, [], []);
      const html = renderToStaticMarkup(<SendFriendRoomInvite roomId={roomId}/>);
      expect(html).toContain('초대할 친구가 없습니다');
      expect(html).toContain('disabled=""');
      expect(html).not.toContain('[object Object]');
    }
  });

  it('filters received invitation object nicknames and invalid timestamps before JSX', () => {
    const badReceived: unknown[] = [
      { ...received, inviterNickname: { bad: true } },
      { ...received, inviterId: null },
      { ...received, createdAt: {} },
      { ...received, expiresAt: 'invalid-date' },
      null,
      received,
    ];
    expect(isReceivedRoomInvite(badReceived[0])).toBe(false);
    expect(isReceivedRoomInvite(badReceived[1])).toBe(false);
    expect(validReceivedRoomInvites(badReceived)).toEqual([received]);
    mockResource({ friends: [] }, [], badReceived);
    const html = renderToStaticMarkup(<ReceivedRoomInvites/>);
    expect(html).toContain('받은 대전 초대 (1)');
    expect(html).toContain('초대한 친구');
    expect(html).toContain('수락');
    expect(html).not.toContain('[object Object]');
  });

  it('does not render malformed received items or action buttons as valid invitations', () => {
    mockResource(null, null, [{ ...received, inviterNickname: { bad: true } }]);
    const html = renderToStaticMarkup(<ReceivedRoomInvites/>);
    expect(html).toContain('받은 대전 초대 (0)');
    expect(html).toContain('지금 받은 대전 초대가 없습니다');
    expect(html).not.toContain('>수락</button>');
    expect(html).not.toContain('[object Object]');
  });

  it('rejects invalid sent status, invitee nickname objects, ids and dates', () => {
    const badSent: unknown[] = [
      { ...sent, inviteeNickname: { bad: true } },
      { ...sent, id: null },
      { ...sent, status: 'unexpected' },
      { ...sent, expiresAt: [] },
      { ...sent, inviteeId: null },
      null,
      sent,
      { ...sent, id: '55555555-5555-4555-8555-555555555555', inviteeNickname: null },
    ];
    expect(isSentRoomInvite(badSent[0])).toBe(false);
    expect(isSentRoomInvite(badSent[2])).toBe(false);
    expect(validSentRoomInvites(badSent)).toHaveLength(2);
    mockResource({ friends: [friend] }, badSent, []);
    const html = renderToStaticMarkup(<SendFriendRoomInvite roomId={roomId}/>);
    expect(html).toContain('초대한 친구');
    expect(html).toContain('응답 대기');
    expect(html).toContain('>친구</strong>');
    expect(html).not.toContain('[object Object]');
    expect(html.match(/class="arena-invite-status"/g)).toHaveLength(2);
  });

  it('keeps empty sent state safe when the only sent item has object nickname', () => {
    mockResource({ friends: [friend] }, [{ ...sent, inviteeNickname: {} }], []);
    const html = renderToStaticMarkup(<SendFriendRoomInvite roomId={roomId}/>);
    expect(html).toContain('아직 이 방에서 보낸 초대가 없습니다');
    expect(html).not.toContain('arena-invite-status');
  });
});
