import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { CookieMethodsServer } from '@supabase/ssr';
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), config: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('../src/lib/supabase/config', () => ({ getSupabaseConfig: mocks.config }));
import { proxy, config as proxyConfig } from '../src/proxy';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ url: 'https://test.supabase.co', key: 'test' });
});
describe('merged route protection scope', () => {
  it('retains player discovery, direct messages, and room invite API matchers', () => {
    expect(proxyConfig.matcher).toEqual(expect.arrayContaining([
      '/players/:path*',
      '/api/messages/:path*',
      '/api/room-invites/:path*',
    ]));
  });
});

describe('session refresh proxy', () => {
  it('passes all refreshed cookie chunks to the page and browser without caching', async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options: { cookies: CookieMethodsServer }) => ({
      auth: { getUser: async () => {
        await options.cookies.setAll?.([{ name: 'session.0', value: 'part0', options: { path: '/', httpOnly: true } }], { 'Cache-Control': 'private, no-store' });
        await options.cookies.setAll?.([{ name: 'session.1', value: 'part1', options: { path: '/', httpOnly: true } }], {});
      } },
    }));
    const request = new NextRequest('https://example.com/lobby');
    const response = await proxy(request);
    expect(request.cookies.get('session.0')?.value).toBe('part0');
    expect(request.cookies.get('session.1')?.value).toBe('part1');
    expect(response.cookies.get('session.0')?.value).toBe('part0');
    expect(response.cookies.get('session.1')?.value).toBe('part1');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('does not crash the public auth page when configuration is missing', async () => {
    mocks.config.mockReturnValue(null);
    expect((await proxy(new NextRequest('https://example.com/login'))).status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
  it('leaves final authorization to protected pages after refresh transport failure', async () => {
    mocks.createServerClient.mockReturnValue({ auth: { getUser: vi.fn().mockRejectedValue(new Error('network')) } });
    const response = await proxy(new NextRequest('https://example.com/lobby'));
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.cookies.getAll()).toHaveLength(0);
  });
});
