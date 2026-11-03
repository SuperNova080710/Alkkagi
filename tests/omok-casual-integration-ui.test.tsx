import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  parseRoom, parseMatch, parseMessages, OmokClientError, omokErrorText, omokRequest,
} from '../src/components/omok/omok-client-api';

const uid = (letter: string) => letter.repeat(8) + '-0000-4000-8000-' + letter.repeat(12);
const board = () => Array.from({ length: 15 }, () => Array<null>(15).fill(null));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('Omok backend snapshot contracts (#243)', () => {
  it('parses member-only room RPC data and matches the real camelCase keys', () => {
    const parsed = parseRoom({
      id: uid('a'), code: 'ABCD2345', status: 'waiting', yourSeat: 1,
      matchId: null, players: [{ userId: uid('a'), seat: 1, nickname: '방장' }],
    });
    expect(parsed.players[0].userId).toBe(uid('a'));
    expect(parsed.status).toBe('waiting');
    expect(() => parseRoom({ id: uid('a'), players: [{ id: uid('a') }] })).toThrow();
  });

  it('reads authoritative board and 0-based move history; rejects malformed data', () => {
    const snapshot = parseMatch({ match: {
      id: uid('a'), room_id: uid('b'), black_id: uid('a'), white_id: uid('b'),
      turn_user_id: uid('b'), turn_no: 2, board_state: board(),
      status: 'active', winner_id: null, finish_reason: null,
    }, moves: [{ row_no: 7, col_no: 8, turn_no: 1 }] });
    expect(snapshot.turnNo).toBe(2);
    expect(snapshot.lastMove).toEqual({ row: 7, col: 8 });
    expect(snapshot.board[7][8]).toBeNull();
    expect(() => parseMatch({ match: { board_state: [] }, moves: [] })).toThrow();
  });

  it('uses no-store cookies and reports explicit HTTP status / network ambiguity', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      ok: false, status: 409, json: async () => ({ error: 'STALE_TURN' }),
    }).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ data: { roomId: uid('a') } }),
    }).mockRejectedValueOnce(new TypeError('disconnected'));
    vi.stubGlobal('fetch', fetcher);
    await expect(omokRequest('/api/omok/matches/x/move', {
      method: 'POST', body: { requestId: uid('a'), turnNo: 1, row: 7, col: 7 },
    })).rejects.toMatchObject({ code: 'STALE_TURN', status: 409 });
    expect(await omokRequest('/api/omok/rooms')).toEqual({ roomId: uid('a') });
    await expect(omokRequest('/api/omok/rooms')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: 'same-origin', cache: 'no-store',
    });
    expect(omokErrorText(new OmokClientError('GAME_SERVICE_UNAVAILABLE', 503))).toContain('준비되지 않았습니다');
    expect(omokErrorText(new OmokClientError('AUTH_REQUIRED', 401))).toContain('로그인');
  });

  it('requires participant-scope chat records without synthesizing messages', () => {
    const items = parseMessages([{ id: uid('a'), sender_id: uid('b'),
      body: '안녕', created_at: '2026-11-03T00:00:00Z' }]);
    expect(items).toHaveLength(1);
    expect(parseMessages([{ id: 'bad', body: 'x' }])).toEqual([]);
    expect(() => parseMessages(null)).toThrow();
  });

  it('keeps retry requestId stable, refreshes after Realtime and blocks client-authoritative wins', () => {
    const source = readFileSync(new URL('../src/components/omok/omok-match-client.tsx', import.meta.url), 'utf8');
    expect(source).toContain('moveRequest.current = proposal');
    expect(source).toContain('void sendMove(retryMove)');
    expect(source).toContain('body: move');
    expect(source).toContain('omok_matches');
    expect(source).toContain('omok_moves');
    expect(source).toContain('omok_match_messages');
    expect(source).toContain('await load()');
    expect(source).not.toContain('calculateWinner');
    expect(source).not.toContain('playOmokMove(');
  });
});

const { requireUser, notFound } = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa' })),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('@/lib/auth/user', () => ({ requireUser }));
vi.mock('next/navigation', () => ({
  notFound, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/components/auth/logout-form', () => ({
  LogoutForm: () => <button type="button">로그아웃</button>,
}));
import RoomPage from '../src/app/omok/rooms/[id]/page';
import MatchPage from '../src/app/omok/matches/[id]/page';

describe('Omok protected live routes (#243)', () => {
  it('blocks direct routing when server feature flag is disabled', async () => {
    vi.stubEnv('OMOK_UI_ENABLED', '');
    await expect(RoomPage({ params: Promise.resolve({ id: uid('a') }) })).rejects.toThrow('NOT_FOUND');
    await expect(MatchPage({ params: Promise.resolve({ id: uid('a') }) })).rejects.toThrow('NOT_FOUND');
  });
  it('authenticates and does not create server-side fake results or public room links', async () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(await RoomPage({ params: Promise.resolve({ id: uid('a') }) }));
    expect(html).toContain('오목 대기실을 불러오는 중');
    const game = renderToStaticMarkup(await MatchPage({ params: Promise.resolve({ id: uid('b') }) }));
    expect(game).toContain('오목 경기 정보를 불러오는 중');
    expect(requireUser).toHaveBeenCalledTimes(2);
  });
});
