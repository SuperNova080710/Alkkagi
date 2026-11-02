import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const HOST = '11111111-1111-4111-8111-111111111111';
const GUEST = '22222222-2222-4222-8222-222222222222';
const ROOM = '33333333-3333-4333-8333-333333333333';

const { testState } = vi.hoisted(() => ({
  testState: {
    room: null as unknown,
    viewer: { id: '11111111-1111-4111-8111-111111111111' },
    requests: [] as string[],
  },
}));
vi.mock('@/lib/auth/user', () => ({
  requireUser: async () => testState.viewer,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (name: string) => {
      testState.requests.push(name);
      return { data: testState.room, error: null };
    },
    from: (name: string) => {
      testState.requests.push(name);
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain,
        limit: () => chain, maybeSingle: async () => ({ data: null, error: null }),
      };
      return chain;
    },
  }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => { throw Error('NOT_FOUND'); },
  redirect: (path: string) => { throw Error('REDIRECT:' + path); },
}));
vi.mock('@/components/rooms/room-refresh', () => ({
  RoomRefresh: () => <p data-testid="room-refresh">입장 변경 사항 자동 갱신</p>,
}));
vi.mock('@/components/rooms/add-ai-opponent', () => ({
  AddAiOpponent: () => <p data-testid="ai-opponent">AI 대전 시작</p>,
}));
vi.mock('@/components/rooms/send-friend-room-invite', () => ({
  SendFriendRoomInvite: () => <p data-testid="send-friend-invite">친구에게 대전 초대</p>,
}));
vi.mock('@/components/game/game-board', () => ({
  GameBoard: () => <p data-testid="game-board">경기 진행 중</p>,
}));
vi.mock('../src/app/rooms/actions', () => ({
  leaveRoom: async () => {},
}));
vi.mock('../src/app/rooms/start', () => ({
  startGame: async () => {},
}));
import RoomPage from '../src/app/rooms/[id]/page';

type RoomFixture = {
  id: string; code: string; status: string; yourSeat: number;
  players: { seat: number; nickname: string }[];
};
const host = { seat: 1, nickname: '긴 호스트 닉네임 가가가가가가' };
const guest = { seat: 2, nickname: '게스트' };
function room(overrides: Partial<RoomFixture> = {}): RoomFixture {
  return {
    id: ROOM, code: 'ABCDEFGH', status: 'waiting', yourSeat: 1,
    players: [host], ...overrides,
  };
}
async function html(fixture: RoomFixture, flags: { friends?: boolean; invites?: boolean } = {}) {
  testState.room = fixture;
  vi.stubEnv('FRIENDS_UI_ENABLED', flags.friends ? 'true' : '');
  vi.stubEnv('ROOM_INVITES_UI_ENABLED', flags.invites ? 'true' : '');
  return renderToStaticMarkup(await RoomPage({
    params: Promise.resolve({ id: ROOM }), searchParams: Promise.resolve({}),
  }));
}

beforeEach(() => { testState.requests.length = 0; testState.viewer = { id: HOST }; });
afterEach(() => { vi.unstubAllEnvs(); });

describe('#179 server-rendered casual waiting room/role permissions', () => {
  it('host 1/2: when both flags ON, shows friend invite and AI alongside copy code', async () => {
    const markup = await html(room(), { friends: true, invites: true });
    expect(markup).toContain('data-testid="send-friend-invite"');
    expect(markup).toContain('data-testid="ai-opponent"');
    expect(markup).toContain('코드 복사');
    expect(markup).toContain('친구에게 초대 코드나 대전 초대를 보내');
    expect(markup).toContain('방 닫기');
    expect(markup).not.toContain('>경기 시작</button>');
    expect(markup).toContain('arena-room-wait-layout');
    expect(markup).toContain('arena-room-seats');
    expect(testState.requests).toEqual(['get_casual_room', 'ai_matches', 'matches']);
  });

  it('host 1/2: OFF or partial flags never mount friend invite; AI and code remain available', async () => {
    for (const flags of [{}, { friends: true }, { invites: true }]) {
      const markup = await html(room(), flags);
      expect(markup).not.toContain('data-testid="send-friend-invite"');
      expect(markup).toContain('data-testid="ai-opponent"');
      expect(markup).toContain('코드 복사');
      expect(markup).toContain('방 닫기');
    }
  });

  it('host full 2/2: only host gets start button, both invite/AI add panels disappear', async () => {
    const markup = await html(room({ players: [host, guest] }), { friends: true, invites: true });
    expect(markup).toContain('참가자');
    expect(markup).toContain('경기 시작');
    expect(markup).toContain('name="id"');
    expect(markup).not.toContain('data-testid="send-friend-invite"');
    expect(markup).not.toContain('data-testid="ai-opponent"');
  });

  it('guest 2/2: cannot start, invite, add AI, or close host room', async () => {
    testState.viewer = { id: GUEST };
    const markup = await html(room({ yourSeat: 2, players: [host, guest] }), { friends: true, invites: true });
    expect(markup).not.toContain('data-testid="send-friend-invite"');
    expect(markup).not.toContain('data-testid="ai-opponent"');
    expect(markup).not.toContain('>경기 시작</button>');
    expect(markup).toContain('방 나가기');
    expect(markup).not.toContain('방 닫기');
    expect(markup).toContain('게스트');
  });

  it('guest abnormal 1/2: shows passive waiting message rather than suggesting invites', async () => {
    testState.viewer = { id: GUEST };
    const markup = await html(room({ yourSeat: 2 }), { friends: true, invites: true });
    expect(markup).toContain('방장이 상대를 초대하고 있습니다.');
    expect(markup).not.toContain('초대 코드나 대전 초대를 보내');
    expect(markup).not.toContain('data-testid="send-friend-invite"');
    expect(markup).not.toContain('data-testid="ai-opponent"');
  });

  it('non-waiting room with no active match: does not offer invite, AI, start or leave', async () => {
    const markup = await html(room({ status: 'finished' }), { friends: true, invites: true });
    expect(markup).toContain('방 상태 확인');
    expect(markup).not.toContain('data-testid="send-friend-invite"');
    expect(markup).not.toContain('data-testid="ai-opponent"');
    expect(markup).not.toContain('>경기 시작</button>');
    expect(markup).not.toContain('방 닫기');
  });
});
