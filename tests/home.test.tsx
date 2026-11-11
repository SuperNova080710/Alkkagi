import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../src/app/page';

afterEach(() => vi.unstubAllEnvs());

describe('public platform home', () => {
  it('provides the three existing lobby destinations and account actions', () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    vi.stubEnv('CHESS_UI_ENABLED', 'true');

    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('aria-label="한판아레나 홈"');
    expect(html).toContain('HANPAN ARENA');
    expect(html).toMatch(/href="\/omok"[^>]*>오목 시작하기/);
    expect(html).toMatch(/href="\/chess"[^>]*>체스 시작하기/);
    expect(html).toMatch(/href="\/lobby"[^>]*>알까기 시작하기/);
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/how-to-play"');
    expect(html).toContain('href="#arena-content"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('shows disabled games without sending visitors to their gated lobbies', () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'false');
    vi.stubEnv('CHESS_UI_ENABLED', 'false');

    const html = renderToStaticMarkup(<Home />);
    expect(html.match(/현재 이용할 수 없습니다/g)).toHaveLength(2);
    expect(html).not.toContain('href="/omok"');
    expect(html).not.toContain('href="/chess"');
    expect(html).toMatch(/href="\/lobby"[^>]*>알까기 시작하기/);
  });
});
