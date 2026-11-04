import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const gate = vi.hoisted(() => ({
  mode: 'ranked' as 'ranked' | 'casual',
  member: true,
  rpc: vi.fn(async () => ({ data: { id: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb' }, error: null })),
  verified: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa' })),
  messageQueries: vi.fn(),
}));

vi.mock('@/lib/auth/user', () => ({ getVerifiedUser: gate.verified }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'omok_matches') return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: gate.member ? { id: 'cccccccc-0000-4000-8000-cccccccccccc', mode: gate.mode } : null,
              error: null,
            }),
          }),
        }),
      };
      if (table === 'omok_match_messages') {
        gate.messageQueries();
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      throw Error('Unexpected table: ' + table);
    },
    rpc: gate.rpc,
  }),
}));

import { GET, POST } from '../src/app/api/omok/matches/[id]/messages/route';

const matchId = 'cccccccc-0000-4000-8000-cccccccccccc';
const requestUrl = 'http://localhost/api/omok/matches/' + matchId + '/messages';
const params = { params: Promise.resolve({ id: matchId }) };
afterEach(() => {
  gate.mode = 'ranked';
  gate.member = true;
  vi.clearAllMocks();
});

describe('v0.3.1 Omok chat mode boundary (#300)', () => {
  it('rejects ranked chat reads and writes before message query or RPC', async () => {
    gate.mode = 'ranked';
    const read = await GET(new NextRequest(requestUrl), params);
    const write = await POST(new NextRequest(requestUrl, {
      method: 'POST',
      body: JSON.stringify({ body: 'ranked chat', requestId: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb' }),
    }), params);
    expect(read.status).toBe(403);
    expect(await read.json()).toEqual({ error: 'CHAT_NOT_AVAILABLE' });
    expect(write.status).toBe(403);
    expect(await write.json()).toEqual({ error: 'CHAT_NOT_AVAILABLE' });
    expect(gate.messageQueries).not.toHaveBeenCalled();
    expect(gate.rpc).not.toHaveBeenCalled();
  });

  it('preserves casual chat GET/POST and participant privacy', async () => {
    gate.mode = 'casual';
    const read = await GET(new NextRequest(requestUrl), params);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ data: [] });
    expect(gate.messageQueries).toHaveBeenCalledOnce();
    const write = await POST(new NextRequest(requestUrl, {
      method: 'POST',
      body: JSON.stringify({ body: 'casual chat', requestId: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb' }),
    }), params);
    expect(write.status).toBe(200);
    expect(gate.rpc).toHaveBeenCalledOnce();
    gate.member = false;
    expect((await GET(new NextRequest(requestUrl), params)).status).toBe(404);
    expect((await POST(new NextRequest(requestUrl, {
      method: 'POST',
      body: JSON.stringify({ body: 'private', requestId: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb' }),
    }), params)).status).toBe(404);
    expect(gate.rpc).toHaveBeenCalledOnce();
  });

  it('keeps authentication ahead of both chat endpoints', async () => {
    gate.verified.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect((await GET(new NextRequest(requestUrl), params)).status).toBe(401);
    expect((await POST(new NextRequest(requestUrl, {
      method: 'POST',
      body: JSON.stringify({ body: 'nope', requestId: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb' }),
    }), params)).status).toBe(401);
    expect(gate.rpc).not.toHaveBeenCalled();
  });
});
