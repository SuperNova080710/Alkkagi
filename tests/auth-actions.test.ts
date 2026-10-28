import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), getUser: vi.fn(),
  exchangeCodeForSession: vi.fn(), createClient: vi.fn(), getSupabaseConfig: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }), revalidatePath: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/config', () => ({ getSupabaseConfig: mocks.getSupabaseConfig }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
import { login, signup, logout } from '../src/app/auth/actions';
import { getVerifiedUser, requireUser } from '../src/lib/auth/user';
import { GET } from '../src/app/auth/callback/route';
import { NextRequest } from 'next/server';

function credentials() {
  const form = new FormData();
  form.set('email', 'player@example.com'); form.set('password', 'password123'); form.set('passwordConfirm', 'password123');
  return form;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`); });
  mocks.getSupabaseConfig.mockReturnValue({ url: 'https://test.supabase.co', key: 'test' });
  mocks.createClient.mockResolvedValue({ auth: mocks });
});

describe('server authentication actions (mocked Auth transport)', () => {
  it('rejects invalid input before calling Supabase', async () => {
    expect((await login({}, new FormData())).error).toBeTruthy();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('fails safely when environment is missing', async () => {
    mocks.getSupabaseConfig.mockReturnValue(null);
    expect((await login({}, credentials())).error).toBeTruthy();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('redirects to the lobby only after successful password authentication', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await expect(login({}, credentials())).rejects.toThrow('REDIRECT:/lobby');
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'player@example.com', password: 'password123' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
  it('handles wrong password without redirect or raw error disclosure', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'sensitive detail' } });
    const result = await login({}, credentials());
    expect(result.error).toBeTruthy(); expect(result.error).not.toContain('sensitive');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('reports service failure without falsely logging in', async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error('network'));
    expect((await login({}, credentials())).error).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('does not grant a session to an unconfirmed signup', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect((await signup({}, credentials())).message).toContain('인증 메일');
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe('https://alkkagi-alpha.vercel.app/auth/callback');
  });
  it('supports projects where email confirmation is already disabled', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(signup({}, credentials())).rejects.toThrow('REDIRECT:/lobby');
  });
  it('signs out this browser and clears the router cache', async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(logout()).rejects.toThrow('REDIRECT:/login');
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });
  it('does not claim logout succeeded when the Auth service rejects it', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'failed' } });
    expect((await logout()).error).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe('protected pages', () => {
  it('uses a server-verified user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'A' } }, error: null });
    expect(await requireUser()).toEqual({ id: 'A' });
  });
  it('fails closed on forged/revoked sessions and transport errors', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'forged' } }, error: { message: 'invalid' } });
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login');
    mocks.getUser.mockRejectedValue(new Error('network'));
    expect(await getVerifiedUser()).toBeNull();
  });
});

describe('PKCE callback', () => {
  it('exchanges a code and uses a fixed local destination even if next is malicious', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest('https://example.com/auth/callback?code=valid&next=https://evil.example'));
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('valid');
    expect(response.headers.get('location')).toBe('https://example.com/lobby');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it.each(['', '?error=access_denied', '?code=used'])('rejects missing, denied or used codes: %s', async query => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { message: 'used' } });
    const response = await GET(new NextRequest(`https://example.com/auth/callback${query}`));
    expect(response.headers.get('location')).toBe('https://example.com/login?error=callback');
  });
});
