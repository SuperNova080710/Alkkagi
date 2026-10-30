import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const { auth } = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
}));
vi.mock('@/lib/auth/user', () => ({ requireUser: auth }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import FriendsPage from '../src/app/friends/page';
import { FriendsView } from '../src/components/friends/friends-view';
import { SendFriendRoomInvite } from '../src/components/rooms/send-friend-room-invite';
import { ReceivedRoomInvites } from '../src/components/rooms/received-room-invites';
import {
  inviteTime, isRoomUuid, roomInviteError, roomInviteMutation, roomInviteRequest, RoomInviteError,
} from '../src/components/rooms/room-invite-api';

const roomId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('friend room invitations UI and 3D waiting room contract', () => {
  it('keeps receiver API consumer unmounted unless both flags are explicitly true', async () => {
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('ROOM_INVITES_UI_ENABLED', '');
    const without = renderToStaticMarkup(await FriendsPage());
    expect(without).not.toContain('받은 대전 초대');
    vi.stubEnv('ROOM_INVITES_UI_ENABLED', 'true');
    const withInvites = renderToStaticMarkup(await FriendsPage());
    expect(withInvites).toContain('받은 대전 초대');
    expect(withInvites).toContain('초대 목록을 확인하는 중');
    vi.stubEnv('FRIENDS_UI_ENABLED', '');
    const disabled = renderToStaticMarkup(await FriendsPage());
    expect(disabled).toContain('친구 기능 준비 중');
    expect(disabled).not.toContain('받은 대전 초대');
    expect(auth).toHaveBeenCalledTimes(3);
  });

  it('shows friendly incoming and host waiting states on first render without fabricated data', () => {
    const inbox = renderToStaticMarkup(<ReceivedRoomInvites/>);
    expect(inbox).toContain('받은 대전 초대 (0)');
    expect(inbox).toContain('초대 목록을 확인하는 중');
    expect(inbox).not.toContain('수락하면');
    expect(inbox).not.toContain('친구에게 대전 초대');
    const host = renderToStaticMarkup(<SendFriendRoomInvite roomId={roomId}/>);
    expect(host).toContain('친구에게 대전 초대');
    expect(host).toContain('친구를 선택해 주세요');
    expect(host).toContain('발송 상태 확인 중');
    expect(host).toContain('disabled=""');
    expect(host).not.toContain('초대를 보냈습니다');
    const friend = renderToStaticMarkup(<FriendsView roomInvitesEnabled/>);
    expect(friend).toContain('받은 대전 초대');
    expect(renderToStaticMarkup(<FriendsView/>)).not.toContain('받은 대전 초대');
  });

  it('only permits UUIDs and never renders unsafe request paths', () => {
    expect(isRoomUuid(roomId)).toBe(true);
    expect(isRoomUuid(targetId)).toBe(true);
    for (const value of [null, '', '123', '../../../api/admin', 'NaN', 17])
      expect(isRoomUuid(value)).toBe(false);
    expect(inviteTime('invalid')).toBe('만료 시각 확인 필요');
  });

  it('sends exactly roomId and targetId in same-origin POST body', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { inviteId: roomId, status: 'pending', alreadyPending: false } }),
    });
    vi.stubGlobal('fetch', fetcher);
    await roomInviteMutation('/api/room-invites', { roomId, targetId });
    expect(fetcher).toHaveBeenCalledWith('/api/room-invites', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, targetId }),
    }));
    await roomInviteMutation('/api/room-invites/'+roomId+'/respond', { accept: true });
    expect(fetcher).toHaveBeenLastCalledWith('/api/room-invites/'+roomId+'/respond', expect.objectContaining({
      body: '{"accept":true}',
    }));
  });

  it('does not expose backend SQL/errors and handles 401,404,409,429,503', async () => {
    for (const [status, code] of [
      [401,'AUTH_REQUIRED'], [404,'ROOM_NOT_AVAILABLE'], [404,'ROOM_INVITE_NOT_FOUND'],
      [409,'ROOM_INVITE_ALREADY_SENT'], [429,'ROOM_INVITE_RATE_LIMIT'], [503,'ROOM_INVITE_SERVICE_UNAVAILABLE'],
    ] as const) {
      const message = roomInviteError(new RoomInviteError(status, code));
      expect(message.length).toBeGreaterThan(9);
      expect(message).not.toContain('SQL');
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, json: async () => { throw Error('private SQL stack'); },
    }));
    await expect(roomInviteRequest('/api/room-invites')).rejects.toMatchObject({ status: 503, code: 'UNKNOWN' });
    expect(roomInviteError(new RoomInviteError(503, 'private SQL stack'))).not.toContain('private');
  });

  it('preserves game actions and limits invite UI to host waiting room in source', () => {
    const route = readFileSync(new URL('../src/app/rooms/[id]/page.tsx', import.meta.url), 'utf8');
    expect(route).toContain('room.status===\'waiting\'&&room.players.length<2&&room.yourSeat===1');
    expect(route).toContain("process.env.ROOM_INVITES_UI_ENABLED==='true'&&process.env.FRIENDS_UI_ENABLED==='true'");
    expect(route).toContain('<SendFriendRoomInvite roomId={room.id}/>');
    expect(route).toContain('action={startGame}');
    expect(route).toContain('action={leaveRoom}');
    expect(route).toContain('<GameBoard key={match.id}');
    expect(route).toContain('validBoard(match.board_state)');
  });

  it('reuses common 3D button and panel classes across room entry and AI', () => {
    const forms = readFileSync(new URL('../src/components/rooms/room-forms.tsx', import.meta.url), 'utf8');
    const ai = readFileSync(new URL('../src/components/rooms/add-ai-opponent.tsx', import.meta.url), 'utf8');
    expect(forms).toContain('arena-button arena-button--gold');
    expect(forms).toContain('arena-button arena-button--blue');
    expect(forms).toContain('action={createAction}');
    expect(forms).toContain('action={joinAction}');
    expect(ai).toContain('arena-button arena-button--blue');
    expect(ai).toContain('defaultChecked={difficulty === \'normal\'}');
    expect(ai).toContain('action={action}');
  });
});
