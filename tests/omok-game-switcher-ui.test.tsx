import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const { auth, notFound } = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('@/lib/auth/user', () => ({ requireUser: auth }));
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/auth/logout-form', () => ({ LogoutForm: () => <button type="button">로그아웃</button> }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const data = table === 'profiles' ? { nickname: '오목 사용자' }
        : table === 'omok_matches' ? [{ id: 'casual-id', room_id: 'room-id', mode: 'casual' }]
          : [{ id: 'ai-id' }];
      const chain = {
        select() { return this; },
        eq() { return this; },
        or() { return this; },
        order() { return this; },
        limit: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
      };
      return chain;
    },
    rpc: async () => ({ data: { rating: 1200, leaderboard: [
      { position: 1, nickname: '오목 사용자', rating: 1200 },
    ] }, error: null }),
  }),
}));

import OmokPage from '../src/app/omok/page';
import { GameSwitcher } from '../src/components/lobby/game-switcher';
import { LobbyView, type LobbyData } from '../src/components/lobby/lobby-view';

const lobby: LobbyData = {
  nickname: '테스트 플레이어', rating: 1560, leaderboard: [],
  rankingUnavailable: false, activeCasual: [{ id: 'match1', room_id: 'room1' }],
  activeAi: [{ room_id: 'ai1' }], recoveryUnavailable: false,
};
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('multi-game lobby UI v0.3 (#236)', () => {
  it('keeps existing Alkkagi lobby unchanged with the flag OFF by default', () => {
    const html = renderToStaticMarkup(<LobbyView data={lobby} modes={<p>기존 세 가지 대전 모드</p>}/>);
    expect(html).not.toContain('aria-label="게임 선택"');
    expect(html).not.toContain('href="/omok"');
    expect(html).toContain('기존 세 가지 대전 모드');
    expect(html).toContain('1,560 RP');
    expect(html).toContain('href="/rooms/room1"');
    expect(html).toContain('href="/rooms/ai1/ai"');
    expect(html).toContain('href="/profile"');
  });

  it('adds accessible page navigation without replacing Alkkagi modes when ON', () => {
    const html = renderToStaticMarkup(<LobbyView data={lobby} modes={<p>기존 모드</p>} omokEnabled/>);
    expect(html).toContain('aria-label="게임 선택"');
    expect(html).toContain('href="/omok"');
    expect(html).toContain('href="/lobby"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('arena-lobby-grid--multigame');
    expect(html).toContain('기존 모드');
    expect(html).toContain('1,560 RP');
    expect(html).toContain('href="/rooms/room1"');
  });

  it('sets active game with actual links instead of fake interactive tab roles', () => {
    const alkkagi = renderToStaticMarkup(<GameSwitcher current="alkkagi"/>);
    const omok = renderToStaticMarkup(<GameSwitcher current="omok"/>);
    expect(alkkagi).toContain('class="is-active" aria-current="page" href="/lobby"');
    expect(omok).toContain('class="is-active" aria-current="page" href="/omok"');
    expect(omok).not.toContain('role="tab"');
    expect(omok).toContain('aria-label="게임 선택"');
  });

  it('blocks direct omok URL when server feature flag is OFF without authenticating', async () => {
    vi.stubEnv('OMOK_UI_ENABLED', '');
    await expect(OmokPage()).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
    expect(auth).not.toHaveBeenCalled();
  });

  it('renders authenticated omok overview under the server ON gate', async () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(await OmokPage());
    expect(auth).toHaveBeenCalledOnce();
    expect(html).toContain('오목 아레나');
    expect(html).toContain('15×15 오목');
    expect(html).toContain('arena-omok-rules');
    expect(html).toContain('가로·세로·대각선');
    expect(html).toContain('aria-label="오목 대전 방식"');
    expect(html).toContain('href="/lobby"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('로그아웃');
  });

  it('connects three Omok modes under the flag while preserving existing Alkkagi links', async () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(await OmokPage());
    expect(html).toContain('일반전');
    expect(html).toContain('AI 대전');
    expect(html).toContain('랭크전');
    expect(html).not.toContain('href="/omok/ai"');
    expect(html).toContain('AI 연습 시작');
    expect(html).toContain('href="/omok/ranked"');
    expect(html).not.toContain('준비 중</button>');
    expect(html).toContain('arena-lobby-grid arena-lobby-grid--multigame');
    expect(html).toContain('arena-hero--omok');
    expect(html).toContain('오목 랭킹 TOP 3');
    expect(html).toContain('오목 RP');
    expect(html).toContain('href="/omok/matches/casual-id"');
    expect(html).toContain('href="/omok/ai/ai-id"');
    expect(html).toContain('방 만들기 · 코드로 참가');
    expect(html).toContain('새 방 만들기');
    expect(html).toContain('aria-labelledby="omok-mode-dialog-title"');
    expect(html).not.toContain('href="#omok-casual-start"');
    expect(html).not.toContain('href="/omok/rooms/');
  });

  it('uses 3D visual tokens and responsive 44px game switching targets', () => {
    const css = readFileSync(new URL('../src/app/arena.css', import.meta.url), 'utf8');
    const section = css.slice(css.indexOf('/* #236: gated v0.3'));
    expect(section).toContain('.arena-game-switcher');
    expect(section).toContain('min-height: 44px');
    expect(section).toContain('.arena-lobby-grid--multigame');
    const parity = readFileSync(new URL('../src/components/omok/omok-parity.css', import.meta.url), 'utf8');
    expect(parity).toContain('.arena-hero--omok');
    expect(parity).toContain('.arena-mode--omok');
    expect(section).toContain('(max-width: 500px)');
    expect(section).toContain('grid-template-columns: 1fr');
    expect(section).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
    expect(section).not.toContain('.game-screen');
  });
});
