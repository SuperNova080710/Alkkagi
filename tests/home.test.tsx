import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/auth/home/route';
import { getVerifiedUser } from '../src/lib/auth/user';
import Home from '../src/app/page';

vi.mock('../src/lib/auth/user', () => ({ getVerifiedUser: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('public platform home', () => {
  it('provides the three existing lobby destinations and account actions', () => {
    vi.stubEnv('OMOK_UI_ENABLED', 'true');
    vi.stubEnv('CHESS_UI_ENABLED', 'true');

    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('href="/auth/home" class="arena-brand" aria-label="한판아레나 홈"');
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

describe('arena brand destination', () => {
  it.each([
    { signedIn: true, destination: '/lobby' },
    { signedIn: false, destination: '/' },
  ])('returns a private redirect to $destination when signed in is $signedIn', async ({ signedIn, destination }) => {
    vi.mocked(getVerifiedUser).mockResolvedValue(signedIn ? { id: 'signed-in-player', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } : null);
    const request = new NextRequest('https://arena.example.test/auth/home');

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(new URL(destination, request.url).href);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
