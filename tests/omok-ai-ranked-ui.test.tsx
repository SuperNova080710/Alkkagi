import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OmokClientError } from '../src/components/omok/omok-client-api';
import { parseAiSnapshot, OmokAiLobby } from '../src/components/omok/omok-ai-client';
import { parseQueueState, parseRankedDashboard, OmokRankedLobby, refreshRankedLobbyData } from '../src/components/omok/omok-ranked-client';
import { OmokRankedMatchMeta } from '../src/components/omok/omok-ranked-match-meta';

const { auth, notFound } = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ id: 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa' })),
  notFound: vi.fn(() => { throw Error('NOT_FOUND'); }),
}));
vi.mock('@/lib/auth/user', () => ({ requireUser: auth }));
vi.mock('next/navigation', () => ({
  notFound, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/auth/logout-form', () => ({
  LogoutForm: () => <button type="button">로그아웃</button>,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: { nickname: '오목 사용자' }, error: null }),
    }),
  }),
}));
import AiLobbyPage from '../src/app/omok/ai/page';
import AiMatchPage from '../src/app/omok/ai/[id]/page';
import RankedLobbyPage from '../src/app/omok/ranked/page';
import RankedMatchPage from '../src/app/omok/ranked/matches/[id]/page';

const id = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('v0.3.0 Omok AI UI (#244)', () => {
  it('renders three authentic difficulty choices and explicit confirmation before API mutation', () => {
    const html = renderToStaticMarkup(<OmokAiLobby/>);
    expect(html).toContain('쉬움');
    expect(html).toContain('보통');
    expect(html).toContain('어려움');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain('선택한 난이도 확인');
    expect(html).toContain('랭크 RP에 영향을 주지 않습니다');
    expect(html).not.toContain('XP +');
  });
  it('validates authoritative AI match board, final state, and last AI move', () => {
    const board = Array.from({ length:15 }, () => Array<null>(15).fill(null));
    const parsed = parseAiSnapshot({ match: {
      id, difficulty:'hard', turn_no:3, board_state:board,
      status:'finished', winner:'ai', finish_reason:'five',
    }, turns:[{ human_row:6, human_col:7, ai_row:7, ai_col:8 }] });
    expect(parsed.difficulty).toBe('hard');
    expect(parsed.winner).toBe('ai');
    expect(parsed.lastMove).toEqual({row:7,col:8});
    expect(() => parseAiSnapshot({ match:{ id }, turns:[] })).toThrow();
  });
});
describe('v0.3.0 independent Omok ranked UI (#244)', () => {
  it('only accepts ranked queue status from the actual server contract', () => {
    expect(parseQueueState({status:'queued',matchId:null})).toEqual({status:'queued',matchId:null});
    expect(parseQueueState({status:'matched',matchId:id}).matchId).toBe(id);
    expect(() => parseQueueState({status:'matched',matchId:null})).toThrow();
    expect(() => parseQueueState({status:'pretend'})).toThrow();
  });
  it('renders actual independent ranked rating fields without fabricating leaderboard data', () => {
    const result = parseRankedDashboard({rating:1040,leaderboard:[{
      position:1,nickname:'길고긴유저',rating:1040,wins:2,losses:1,draws:0,
    }]});
    expect(result.rating).toBe(1040);
    expect(result.leaderboard).toHaveLength(1);
    expect(result.leaderboard[0].nickname).toBe('길고긴유저');
    expect(() => parseRankedDashboard({rating:null,leaderboard:[]})).toThrow();
    const markup = renderToStaticMarkup(<OmokRankedLobby/>);
    expect(markup).toContain('나의 오목 RP');
    expect(markup).toContain('랭크 매칭 시작');
    expect(markup).toContain('리더보드 TOP 100');
    expect(markup).not.toContain('1,000 RP');
  });
  it('enters a matched game immediately even when the leaderboard is still pending then returns 503', async () => {
    let failDashboard!: (reason: unknown) => void;
    const dashboard = new Promise<unknown>((_, reject) => { failDashboard = reject; });
    const replace = vi.fn();
    const applyQueue = vi.fn((value: { status: string; matchId: string | null }) => {
      if (value.status === 'matched' && value.matchId)
        replace('/omok/ranked/matches/' + value.matchId);
    });
    const applyDashboard = vi.fn();
    const reportQueueError = vi.fn();
    const reportDashboardError = vi.fn();
    const request = vi.fn((url: string): Promise<unknown> =>
      url === '/api/omok/ranked/queue'
        ? Promise.resolve({ status: 'matched', matchId: id })
        : dashboard);
    const refreshing = refreshRankedLobbyData({
      isActive: () => true, applyQueue, applyDashboard,
      reportQueueError, reportDashboardError,
    }, request);
    // A delayed leaderboard must not postpone the successful queue redirect.
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/omok/ranked/matches/' + id));
    expect(applyQueue).toHaveBeenCalledWith({ status: 'matched', matchId: id });
    expect(reportQueueError).toHaveBeenCalledWith('');
    expect(applyDashboard).not.toHaveBeenCalled();
    failDashboard(new OmokClientError('GAME_SERVICE_UNAVAILABLE', 503));
    await refreshing;
    expect(reportDashboardError).toHaveBeenCalledWith(expect.stringContaining('준비되지 않았습니다'));
    expect(reportQueueError).not.toHaveBeenCalledWith(expect.stringContaining('준비되지 않았습니다'));
    expect(request).toHaveBeenCalledWith('/api/omok/ranked/dashboard');
  });

  it('keeps leaderboard data available if queue polling fails and rejects malformed dashboard only locally', async () => {
    const applyQueue = vi.fn();
    const applyDashboard = vi.fn();
    const reportQueueError = vi.fn();
    const reportDashboardError = vi.fn();
    await refreshRankedLobbyData({
      isActive: () => true, applyQueue, applyDashboard,
      reportQueueError, reportDashboardError,
    }, async url => {
      if (url.endsWith('/queue')) throw new OmokClientError('GAME_SERVICE_UNAVAILABLE', 503);
      return { rating: 1040, leaderboard: [] };
    });
    expect(applyQueue).not.toHaveBeenCalled();
    expect(reportQueueError).toHaveBeenCalledWith(expect.stringContaining('준비되지 않았습니다'));
    expect(applyDashboard).toHaveBeenCalledWith({ rating: 1040, leaderboard: [] });
    expect(reportDashboardError).toHaveBeenCalledWith('');

    reportQueueError.mockClear();
    reportDashboardError.mockClear();
    applyQueue.mockClear();
    applyDashboard.mockClear();
    await refreshRankedLobbyData({
      isActive: () => true, applyQueue, applyDashboard,
      reportQueueError, reportDashboardError,
    }, async url => url.endsWith('/queue')
      ? { status: 'matched', matchId: id } : { rating: null, leaderboard: [] });
    expect(applyQueue).toHaveBeenCalledWith({ status: 'matched', matchId: id });
    expect(reportQueueError).toHaveBeenCalledWith('');
    expect(applyDashboard).not.toHaveBeenCalled();
    expect(reportDashboardError).toHaveBeenCalledWith(expect.any(String));
  });

  it('does not apply late ranking or queue results after leaving the lobby', async () => {
    let active = true;
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>(resolve => { release = resolve; });
    const applyQueue = vi.fn();
    const applyDashboard = vi.fn();
    const reportQueueError = vi.fn();
    const reportDashboardError = vi.fn();
    const refreshing = refreshRankedLobbyData({
      isActive: () => active, applyQueue, applyDashboard,
      reportQueueError, reportDashboardError,
    }, async () => pending);
    active = false;
    release({ status: 'matched', matchId: id });
    await refreshing;
    expect(applyQueue).not.toHaveBeenCalled();
    expect(applyDashboard).not.toHaveBeenCalled();
    expect(reportQueueError).not.toHaveBeenCalled();
    expect(reportDashboardError).not.toHaveBeenCalled();
  });

  it('reads only own RLS-protected rating history and real deadline; no optimistic RP', () => {
    const markup = renderToStaticMarkup(<OmokRankedMatchMeta matchId={id} currentUserId={id}/>);
    expect(markup).toContain('정산 확인 중');
    expect(markup).toContain('90초 턴 제한');
    const code = readFileSync(new URL('../src/components/omok/omok-ranked-match-meta.tsx', import.meta.url),'utf8');
    expect(code).toContain("from('omok_rating_history')");
    expect(code).toContain(".eq('user_id',currentUserId)");
    expect(code).toContain("from('omok_matches')");
    expect(code).toContain("'/expire'");
    expect(code).not.toContain('profiles.rating');
    const queue = readFileSync(new URL('../src/components/omok/omok-ranked-client.tsx', import.meta.url),'utf8');
    expect(queue).toContain('18000');
    expect(queue).toContain("intent: 'join'");
    expect(queue).toContain("intent === 'cancel'");
    expect(queue).not.toContain("changeRankedQueue");
  });
});
describe('protected AI/ranked pages and UI boundaries', () => {
  it('blocks all new direct routes with OMOK_UI_ENABLED unset', async () => {
    vi.stubEnv('OMOK_UI_ENABLED','');
    await expect(AiLobbyPage()).rejects.toThrow('NOT_FOUND');
    await expect(AiMatchPage({params:Promise.resolve({id})})).rejects.toThrow('NOT_FOUND');
    await expect(RankedLobbyPage()).rejects.toThrow('NOT_FOUND');
    await expect(RankedMatchPage({params:Promise.resolve({id})})).rejects.toThrow('NOT_FOUND');
    expect(auth).not.toHaveBeenCalled();
  });
  it('renders authenticated AI/ranked SSR shells without synthetic match data', async () => {
    vi.stubEnv('OMOK_UI_ENABLED','true');
    const ai = renderToStaticMarkup(await AiLobbyPage());
    const rank = renderToStaticMarkup(await RankedLobbyPage());
    const game = renderToStaticMarkup(await RankedMatchPage({params:Promise.resolve({id})}));
    expect(ai).toContain('AI 오목 연습');
    expect(rank).toContain('나의 오목 RP');
    expect(game).toContain('오목 경기 정보를 불러오는 중');
    expect(auth).toHaveBeenCalledTimes(3);
  });
  it('isolates stylesheet without hiding global scroll or modifying Alkkagi arena', () => {
    const css = readFileSync(new URL('../src/components/omok/omok-competitive.css',import.meta.url),'utf8');
    expect(css).toContain('max-width:580px');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('overflow-x:auto');
    expect(css).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
  });
});
