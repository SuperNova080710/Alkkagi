import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { GameSwitcher } from '../src/components/lobby/game-switcher';

describe('ranked game switcher direct navigation (#282)', () => {
  it('switches Alkkagi and Omok ranking pages without detouring through the lobby', () => {
    const alkkagi = renderToStaticMarkup(<GameSwitcher current="alkkagi" section="ranked"/>);
    const omok = renderToStaticMarkup(<GameSwitcher current="omok" section="ranked"/>);
    for (const html of [alkkagi, omok]) {
      expect(html).toContain('aria-label="랭킹 게임 선택"');
      expect(html).toContain('href="/ranked"');
      expect(html).toContain('href="/omok/ranked"');
      expect(html).not.toContain('href="/lobby"');
      expect(html).not.toContain('href="/omok"');
    }
    expect(alkkagi).toMatch(/aria-current="page" href="\/ranked"/);
    expect(omok).toMatch(/aria-current="page" href="\/omok\/ranked"/);
  });

  it('retains the established lobby switching behavior by default', () => {
    const html = renderToStaticMarkup(<GameSwitcher current="omok"/>);
    expect(html).toContain('aria-label="게임 선택"');
    expect(html).toContain('href="/lobby"');
    expect(html).toContain('href="/omok"');
    expect(html).not.toContain('href="/omok/ranked"');
  });

  it('marks both ranking screens as ranked-target switchers', () => {
    for(const path of [
      '../src/components/ranked/ranked-view.tsx',
      '../src/app/omok/ranked/page.tsx',
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).toContain('section="ranked"');
    }
  });
});
