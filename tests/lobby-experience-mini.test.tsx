import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const { resource, auth, client } = vi.hoisted(() => ({
  resource: vi.fn(),
  auth: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
  client: vi.fn(),
}));
vi.mock('@/components/players/use-player-resource', () => ({
  usePlayerResource: resource,
}));
vi.mock('@/lib/auth/user', () => ({ requireUser: auth }));
vi.mock('@/components/auth/logout-form', () => ({ LogoutForm: () => <span>로그아웃</span> }));
vi.mock('@/components/lobby/lobby-modes', () => ({ LobbyModes: () => <span>대전 모드</span> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: client }));

import LobbyPage from '../src/app/lobby/page';
import { LobbyView, type LobbyData } from '../src/components/lobby/lobby-view';
import { LobbyExperienceMini } from '../src/components/lobby/lobby-experience-mini';
import { type ExperienceData } from '../src/components/experience/experience-panel';

const lobby: LobbyData = {
  nickname: '아주긴닉네임'.repeat(12), rating: 1025,
  rankingUnavailable: false, leaderboard: [],
  activeCasual: [], activeAi: [], recoveryUnavailable: false,
};
const xp: ExperienceData = {
  userId: '11111111-1111-4111-8111-111111111111',
  level: 2, totalXp: 180, currentLevelXp: 80,
  nextLevelCost: 300, nextLevelAt: 400,
  recentRewards: [{
    id: '9007199254740993123', sourceKind: 'ranked',
    sourceId: '22222222-2222-4222-8222-222222222222',
    outcome: 'win', earnedXp: 70, createdAt: '2026-11-01T01:00:00Z',
  }],
};

beforeEach(() => {
  resource.mockReturnValue({ data: xp, error: null, loading: false });
  client.mockImplementation(async () => ({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        maybeSingle: async () => ({ data: { nickname: '오리온' }, error: null }),
        limit: async () => ({ data: [], error: null }),
      };
      if (!['profiles', 'ai_matches', 'matches'].includes(table)) {
        throw new Error('Unexpected query ' + table);
      }
      return query;
    },
    rpc: async () => ({ data: { rating: 1025, leaderboard: [] }, error: null }),
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('lobby compact XP display (#213)', () => {
  it('shows no experience UI or request when feature flag is off', () => {
    const html = renderToStaticMarkup(<LobbyView data={lobby} modes={null}/>);
    expect(html).toContain('1,025 RP');
    expect(html).toContain(lobby.nickname);
    expect(html).toContain('href="/profile"');
    expect(html).not.toContain('내 레벨과 경험치');
    expect(html).not.toContain('누적 180 XP');
    expect(resource).not.toHaveBeenCalled();
  });

  it('renders a compact level, total XP and accessible next-level progress', () => {
    const html = renderToStaticMarkup(<LobbyView data={lobby} modes={null} experienceEnabled/>);
    expect(html).toContain('1,025 RP');
    expect(html).toContain('Lv.2');
    expect(html).toContain('누적 180 XP');
    expect(html).toContain('80/300');
    expect(html).toContain('max="300"');
    expect(html).toContain('value="80"');
    expect(html).toContain('aria-label="다음 레벨까지 경험치 진행률"');
    expect(html).toContain('27% 달성');
    expect(html).not.toContain('최근 획득 기록');
    expect(html).not.toContain('랭크전 · 승리');
    expect(html).not.toContain('9007199254740993123');
    expect(resource).toHaveBeenCalledWith('/api/experience/me');
  });

  it('shows a neutral loading state without fabricating player XP', () => {
    resource.mockReturnValue({ data: undefined, error: null, loading: true });
    const html = renderToStaticMarkup(<LobbyExperienceMini/>);
    expect(html).toContain('레벨 확인 중');
    expect(html).not.toContain('Lv.1');
    expect(html).not.toContain('0 XP');
    expect(html).not.toContain('<progress');
  });

  it('handles service unavailability and malformed success JSON without crashing', () => {
    for (const response of [
      { data: undefined, error: 503, loading: false },
      { data: { ...xp, nextLevelCost: 'bad' }, error: null, loading: false },
      { data: { ...xp, recentRewards: [null] }, error: null, loading: false },
      { data: null, error: null, loading: false },
    ]) {
      resource.mockReturnValue(response);
      const html = renderToStaticMarkup(<LobbyExperienceMini/>);
      expect(html).toContain('레벨 정보 확인 불가');
      expect(html).not.toContain('Lv.2');
      expect(html).not.toContain('<progress');
    }
  });

  it('shows real 0 XP at level 1 and does not confuse XP with RP', () => {
    resource.mockReturnValue({ data: {
      ...xp, level: 1, totalXp: 0, currentLevelXp: 0,
      nextLevelCost: 100, nextLevelAt: 100, recentRewards: [],
    }, error: null, loading: false });
    const html = renderToStaticMarkup(<LobbyView data={lobby} modes={null} experienceEnabled/>);
    expect(html).toContain('1,025 RP');
    expect(html).toContain('Lv.1');
    expect(html).toContain('누적 0 XP');
    expect(html).toContain('0/100');
    expect(html).toContain('0% 달성');
  });

  it('mounts XP only with the server experience flag on the real lobby page', async () => {
    vi.stubEnv('EXPERIENCE_UI_ENABLED', '');
    const off = renderToStaticMarkup(await LobbyPage());
    expect(off).toContain('오리온');
    expect(off).toContain('1,025 RP');
    expect(off).not.toContain('내 레벨과 경험치');
    expect(resource).not.toHaveBeenCalled();
    vi.stubEnv('EXPERIENCE_UI_ENABLED', 'true');
    const on = renderToStaticMarkup(await LobbyPage());
    expect(on).toContain('내 레벨과 경험치');
    expect(on).toContain('누적 180 XP');
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it('keeps mini typography and progress narrow without changing the board or global scroll', () => {
    const css = readFileSync(new URL('../src/app/arena.css', import.meta.url), 'utf8');
    const mini = css.slice(css.indexOf('/* #213: compact XP'));
    expect(mini).toContain('.arena-lobby-xp-progress progress');
    expect(mini).toContain('height: 8px');
    expect(mini).toContain('min-width: 0');
    expect(mini).toContain('flex-wrap: wrap');
    expect(mini).not.toContain('overflow: hidden !important');
    expect(mini).not.toContain('.game-screen');
  });
});
