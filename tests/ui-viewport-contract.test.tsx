import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../src/app/page';
import { LobbyView, type LobbyData } from '../src/components/lobby/lobby-view';

const css = readFileSync(new URL('../src/app/arena.css', import.meta.url), 'utf8');
const baseCss = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const responsive = css.slice(css.indexOf('/* Issue #104: responsive viewport and zoom safety'));

const dashboard: LobbyData = {
  nickname: '긴이름'.repeat(30),
  rating: 1025,
  leaderboard: [
    { position: 1, nickname: '최상위_긴이름'.repeat(15), rating: 1500 },
    { position: 2, nickname: '두번째 플레이어', rating: 1300 },
    { position: 3, nickname: '세번째 플레이어', rating: 1200 },
  ],
  rankingUnavailable: false,
  activeCasual: Array.from({ length: 5 }, (_, i) => ({ id: String(i), room_id: 'room-' + i })),
  activeAi: Array.from({ length: 5 }, (_, i) => ({ room_id: 'ai-' + i })),
  recoveryUnavailable: false,
};

describe('issue #104 responsive accessibility regression contract (not a screenshot test)', () => {
  it('preserves a real header, main, footer and access to the public home actions', () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('class="arena-wrap"');
    expect(html).toContain('id="arena-content"');
    expect(html).toContain('class="arena-footer"');
    expect(html).toContain('href="/lobby"');
    expect(html).toContain('href="/how-to-play"');
    expect(html.match(/class="arena-mode arena-mode--/g)).toHaveLength(3);
  });

  it('keeps all recovery destinations and only the first 3 leaderboard users in long-content lobby', () => {
    const html = renderToStaticMarkup(<LobbyView data={dashboard}
      modes={<p>모드 선택</p>}/>);
    expect(html).toContain('긴이름'.repeat(30));
    expect(html).toContain('최상위_긴이름'.repeat(15));
    expect(html.match(/class="arena-leaderboard"/g)).toHaveLength(1);
    for (let i = 0; i < 5; i++) {
      expect(html).toContain('/rooms/room-' + i);
      expect(html).toContain('/rooms/ai-' + i + '/ai');
    }
  });

  it('reduces short-wide banner minimum per route without changing tall-screen banner rules', () => {
    expect(responsive).toContain('(min-width: 1600px) and (min-height: 900px) and (max-height: 999px)');
    expect(responsive).toMatch(/\.arena-wrap:has\(> main > \.arena-home-modes\) > main > \.arena-hero\s*\{\s*min-height: 244px;/);
    expect(responsive).toMatch(/\.arena-wrap:has\(> main > \.arena-lobby-grid\) > main > \.arena-hero--compact\s*\{\s*min-height: 220px;/);
    expect(responsive).toContain('font-size: clamp(62px, 7.1dvh, 74px)');
    expect(css).toContain('font-size: clamp(74px, calc(6.5dvh + 25px), 100px)');
  });

  it('wraps intermediate-width header nav and narrow cards instead of hiding document overflow', () => {
    expect(responsive).toContain('(min-width: 640px) and (max-width: 1023px)');
    expect(responsive).toMatch(/\.arena-nav\s*\{\s*flex: 1 1 420px;/);
    expect(responsive).toContain('(max-width: 360px)');
    expect(responsive).toContain('grid-template-columns: 72px minmax(0, 1fr)');
    expect(responsive).toContain('font-size: clamp(31px, 12.5vw, 49px)');
    expect(responsive).not.toMatch(/(?:body|\.arena-wrap|\.arena\s*)\s*\{[^}]*overflow:\s*hidden/);
    expect(responsive).not.toContain('transform: scale(');
    expect(responsive).not.toMatch(/\bzoom\s*:/);
  });

  it('does not change the gameplay viewport and pointer/shot geometry rules', () => {
    expect(baseCss).toContain('.game-screen-stage svg');
    expect(baseCss).toContain('touch-action: none;');
    expect(baseCss).toContain('.game-page--playing');
    expect(responsive).not.toContain('.game-screen');
    expect(responsive).not.toContain('.game-page--playing');
  });
});
