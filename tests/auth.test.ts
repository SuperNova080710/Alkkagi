import { afterEach, describe, expect, it, vi } from 'vitest';
import { authError, readCredentials } from '../src/lib/auth/validation';
import { getSupabaseConfig } from '../src/lib/supabase/config';

function form(email = 'person@example.com', password = 'password123') {
  const result = new FormData();
  result.set('email', email); result.set('password', password); result.set('passwordConfirm', password);
  return result;
}
afterEach(() => vi.unstubAllEnvs());
describe('auth boundary validation', () => {
  it('normalizes email without trimming password', () => {
    expect(readCredentials(form(' person@example.com ', ' password123 '), true)).toEqual({ email: 'person@example.com', password: ' password123 ' });
  });
  it.each(['', 'invalid', 'a@b', 'a b@c.com'])('rejects invalid email %s', email => expect(readCredentials(form(email))).toBeNull());
  it('rejects missing or non-text form values', () => {
    expect(readCredentials(new FormData())).toBeNull();
    const data = form(); data.set('password', new Blob(['password123']));
    expect(readCredentials(data)).toBeNull();
  });
  it('checks signup strength, length and confirmation', () => {
    expect(readCredentials(form(undefined, 'short'), true)).toBeNull();
    expect(readCredentials(form(undefined, 'x'.repeat(129)), true)).toBeNull();
    const data = form(); data.set('passwordConfirm', 'different');
    expect(readCredentials(data, true)).toBeNull();
  });
  it('maps unknown errors to generic copy rather than raw server details', () => {
    expect(authError('user_already_exists')).toEqual(authError('internal_error'));
    expect(authError('email_not_confirmed')).toContain('이메일 인증');
    expect(authError('over_email_send_rate_limit')).toContain('잠시 후');
  });
  it('fails safely with missing or invalid config', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(getSupabaseConfig()).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test');
    expect(getSupabaseConfig()).toBeNull();
  });
});
