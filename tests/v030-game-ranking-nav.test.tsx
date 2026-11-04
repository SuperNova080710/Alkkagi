import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ArenaShell } from '../src/components/ui/arena';
import { RankedView } from '../src/components/ranked/ranked-view';

afterEach(() => vi.unstubAllEnvs());

describe('v0.3 game-aware ranking navigation (#282)', () => {
  it('routes the Omok top ranking and lobby menu within the selected game', () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(<ArenaShell current="ranked" game="omok">
      오목 랭킹
    </ArenaShell>);
    expect(html).toContain('href="/omok/ranked" aria-current="page">랭킹');
    expect(html).toContain('href="/omok">로비');
    expect(html).not.toContain('href="/ranked" aria-current="page">랭킹');
  });

  it('preserves Alkkagi default and fails closed when Omok is not enabled', () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    const normal = renderToStaticMarkup(<ArenaShell current="ranked">알까기</ArenaShell>);
    expect(normal).toContain('href="/ranked" aria-current="page">랭킹');
    expect(normal).toContain('href="/lobby">로비');
    vi.stubEnv('OMOK_UI_ENABLED', 'false');
    const gated = renderToStaticMarkup(<ArenaShell game="omok" current="ranked">기본</ArenaShell>);
    expect(gated).toContain('href="/ranked" aria-current="page">랭킹');
    expect(gated).not.toContain('href="/omok/ranked"');
  });

  it('renders a game switcher in Alkkagi ranking only when Omok is available', () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(<RankedView nickname="플레이어" dashboard={null}
      queue={<p>대기열</p>}/>);
    expect(html).toContain('aria-label="게임 선택"');
    expect(html).toContain('href="/omok"');
    vi.stubEnv('OMOK_UI_ENABLED', 'false');
    expect(renderToStaticMarkup(<RankedView nickname="플레이어" dashboard={null}
      queue={<p>대기열</p>}/>)).not.toContain('aria-label="게임 선택"');
  });

  it('keeps Omok match and ranking routes explicitly scoped to game context', () => {
    const paths = [
      '../src/components/omok/omok-lobby-view.tsx',
      '../src/app/omok/ranked/page.tsx',
      '../src/app/omok/ai/page.tsx',
      '../src/app/omok/ai/[id]/page.tsx',
      '../src/app/omok/matches/[id]/page.tsx',
      '../src/app/omok/ranked/matches/[id]/page.tsx',
    ];
    for (const path of paths) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).toContain('game="omok"');
    }
    const ranked = readFileSync(new URL('../src/app/omok/ranked/page.tsx', import.meta.url), 'utf8');
    expect(ranked).toContain('<GameSwitcher current="omok"/>');
    expect(ranked).toContain('OMOK_UI_ENABLED');
  });
});
