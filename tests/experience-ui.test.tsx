import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  user: vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000011' })),
  maybeSingle: vi.fn(async () => ({ data: { nickname: '샘플 플레이어', rating: 1200 }, error: null })),
  notFound: vi.fn(() => { throw new Error('not found'); }),
}));
vi.mock('@/lib/auth/user', () => ({ requireUser: mocks.user }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
}) }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));

import { ExperiencePanel, ExperienceSummary, experiencePercent, isExperienceData, type ExperienceData } from '../src/components/experience/experience-panel';
import { ProfileView } from '../src/components/profile/profile-view';
import ProfilePage from '../src/app/profile/page';
import PlayerPage from '../src/app/players/[id]/page';

const example: ExperienceData = {
  userId: '00000000-0000-4000-8000-000000000011',
  totalXp: 180, level: 2, currentLevelXp: 80,
  nextLevelCost: 300, nextLevelAt: 400,
  recentRewards: [{
    id: '9007199254740993123', sourceKind: 'ranked',
    sourceId: '11111111-1111-4111-8111-111111111111',
    outcome: 'win', earnedXp: 70, createdAt: '2026-10-29T08:00:00Z',
  }],
};

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('experience and level profile UI', () => {
  it('shows server-owned level totals and an accessible progress bar on the personal profile', () => {
    const html = renderToStaticMarkup(<ExperienceSummary data={example} isSelf />);
    expect(html).toContain('Lv.2');
    expect(html).toContain('누적 180 XP');
    expect(html).toContain('80 / 300 XP');
    expect(html).toContain('400 XP');
    expect(html).toContain('aria-label="다음 레벨까지 경험치 진행률"');
    expect(html).toContain('value="80"');
    expect(html).toContain('max="300"');
    expect(html).toContain('최근 획득 기록');
    expect(html).toContain('랭크전 · 승리');
    expect(html).toContain('+70 XP');
  });

  it('never exposes the private reward ledger on a public profile even if passed one', () => {
    const html = renderToStaticMarkup(<ExperienceSummary data={example} />);
    expect(html).toContain('Lv.2');
    expect(html).not.toContain('최근 획득 기록');
    expect(html).not.toContain('랭크전 · 승리');
    expect(html).not.toContain('9007199254740993123');
  });

  it('supports level 1/zero XP and prevents invalid data from rendering fictional results', () => {
    const fresh: ExperienceData = { ...example, level: 1, totalXp: 0,
      currentLevelXp: 0, nextLevelCost: 100, nextLevelAt: 100, recentRewards: [] };
    const html = renderToStaticMarkup(<ExperienceSummary data={fresh} isSelf />);
    expect(html).toContain('Lv.1');
    expect(html).toContain('0 / 100 XP');
    expect(html).toContain('아직 획득 기록이 없습니다');
    expect(experiencePercent(fresh)).toBe(0);
    expect(experiencePercent({ ...example, currentLevelXp: 999 })).toBe(100);
    expect(isExperienceData({ ...example, nextLevelCost: 0 })).toBe(false);
    expect(isExperienceData({ ...example, level: -1 })).toBe(false);
    expect(isExperienceData(example)).toBe(true);
  });

  it('limits the private history to 20 records and does not output raw ids', () => {
    const many = { ...example, recentRewards: Array.from({ length: 25 }, (_, i) => ({
      ...example.recentRewards![0], id: String(i + 1), earnedXp: i + 1,
    })) };
    const html = renderToStaticMarkup(<ExperienceSummary data={many} isSelf />);
    expect(html.match(/class="arena-xp-reward-label"/g)).toHaveLength(20);
    expect(html).toContain('+20 XP');
    expect(html).not.toContain('+25 XP');
  });

  it('keeps the API consumer unmounted when disabled on the profile view', () => {
    const user = { nickname: '샘플', rating: 1000 };
    const disabled = renderToStaticMarkup(<ProfileView profile={user}/>);
    expect(disabled).not.toContain('나의 레벨 · 경험치');
    const enabled = renderToStaticMarkup(<ProfileView profile={user} experienceEnabled/>);
    expect(enabled).toContain('나의 레벨 · 경험치');
    expect(enabled).toContain('레벨 정보를 불러오고 있습니다');
    const errored = renderToStaticMarkup(<ProfileView profile={null} experienceEnabled/>);
    expect(errored).not.toContain('레벨 정보를 불러오고 있습니다');
  });

  it('uses an explicit server flag for the authenticated profile and retains the original profile flow', async () => {
    vi.stubEnv('EXPERIENCE_UI_ENABLED', '');
    const disabled = renderToStaticMarkup(await ProfilePage());
    expect(disabled).toContain('샘플 플레이어');
    expect(disabled).not.toContain('나의 레벨 · 경험치');

    vi.stubEnv('EXPERIENCE_UI_ENABLED', 'true');
    const enabled = renderToStaticMarkup(await ProfilePage());
    expect(enabled).toContain('나의 레벨 · 경험치');
    expect(enabled).toContain('레벨 정보를 불러오고 있습니다');
    expect(mocks.maybeSingle).toHaveBeenCalled();
  });

  it('checks authentication/UUID before activating public player XP UI', async () => {
    const peer = '00000000-0000-4000-8000-000000000012';
    vi.stubEnv('EXPERIENCE_UI_ENABLED', '');
    const disabled = renderToStaticMarkup(await PlayerPage({ params: Promise.resolve({ id: peer }) }));
    expect(disabled).toContain('플레이어 프로필');
    expect(disabled).not.toContain('레벨 · 경험치');
    vi.stubEnv('EXPERIENCE_UI_ENABLED', 'true');
    const enabled = renderToStaticMarkup(await PlayerPage({ params: Promise.resolve({ id: peer }) }));
    // The public profile is loaded first; XP is only requested after it is visible.
    expect(enabled).toContain('프로필을 불러오고');
    expect(enabled).not.toContain('최근 획득 기록');
    await expect(PlayerPage({ params: Promise.resolve({ id: 'not-a-uuid' }) }))
      .rejects.toThrow('not found');
  });

  it('shows a neutral loading state rather than pretending to know the level', () => {
    const html = renderToStaticMarkup(<ExperiencePanel playerId="00000000-0000-4000-8000-000000000012"/>);
    expect(html).toContain('레벨 정보를 불러오고 있습니다');
    expect(html).not.toContain('Lv.1');
    expect(html).not.toContain('아직 획득 기록이 없습니다');
  });
});
