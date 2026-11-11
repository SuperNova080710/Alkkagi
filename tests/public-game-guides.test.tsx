import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../src/app/page';
import GameGuide, { generateMetadata, generateStaticParams } from '../src/app/games/[game]/page';
import { SITE_ORIGIN } from '../src/lib/seo/site';

afterEach(() => vi.unstubAllEnvs());

const games = [
  ['omok', '오목', '/omok', 'OMOK_UI_ENABLED'],
  ['chess', '체스', '/chess', 'CHESS_UI_ENABLED'],
  ['alkkagi', '알까기', '/lobby', null],
] as const;

describe('public game guides', () => {
  it('statically enumerates exactly the three game guides and links them from home', () => {
    const home = renderToStaticMarkup(<Home />);
    expect(generateStaticParams()).toEqual(games.map(([game]) => ({ game })));
    for (const [game] of games) expect(home).toContain(`href="/games/${game}"`);
  });

  it.each(games)('renders %s copy, canonical and existing lobby destination', async (game, name, lobby, flag) => {
    if (flag) vi.stubEnv(flag, 'true');
    const props = { params: Promise.resolve({ game }) };
    const metadata = await generateMetadata(props);
    const html = renderToStaticMarkup(await GameGuide(props));

    expect(metadata.title).toContain(name);
    expect(metadata.description).toContain(name);
    expect(String(metadata.alternates?.canonical)).toBe(`${SITE_ORIGIN}/games/${game}`);
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(html).toContain(`<h1>${name} 게임 소개</h1>`);
    expect(html).toContain(`class="arena-button" href="${lobby}"`);
    expect(html).toContain('aria-label="현재 위치"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/signup"');
    if (game === 'alkkagi') expect(html).toContain('href="/how-to-play"');
  });

  it.each(games.filter(([, , , flag]) => flag))('keeps %s rules public when its lobby is disabled', async (game, name, lobby, flag) => {
    if (flag) vi.stubEnv(flag, 'false');
    const html = renderToStaticMarkup(await GameGuide({ params: Promise.resolve({ game }) }));
    expect(html).toContain(`<h1>${name} 게임 소개</h1>`);
    expect(html).toContain(`${name} 대전을 이용할 수 없습니다.`);
    expect(html).not.toContain(`class="arena-button" href="${lobby}"`);
  });
});
