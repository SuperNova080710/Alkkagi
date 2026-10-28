'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { getAuthOrigin } from '@/lib/auth/origin';
import { authError, readCredentials, type AuthState } from '@/lib/auth/validation';

const unavailable = { error: '인증 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.' };

export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const credentials = readCredentials(form);
  if (!credentials) return { error: '이메일과 비밀번호를 확인해 주세요.' };
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) return { error: authError(error.code) };
  } catch { return unavailable; }
  revalidatePath('/', 'layout');
  redirect('/lobby');
}

export async function signup(_state: AuthState, form: FormData): Promise<AuthState> {
  const credentials = readCredentials(form, true);
  if (!credentials) return { error: '이메일과 8~128자 비밀번호, 비밀번호 확인을 점검해 주세요.' };
  if (!getSupabaseConfig()) return unavailable;
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: `${getAuthOrigin()}/auth/callback` },
    });
    if (error) return { error: authError(error.code) };
    hasSession = Boolean(data.session);
  } catch { return unavailable; }
  if (hasSession) {
    revalidatePath('/', 'layout');
    redirect('/lobby');
  }
  return { message: '가입 요청을 처리했습니다. 인증 메일이 도착하면 가입한 브라우저에서 링크를 열어 주세요. 이미 가입했다면 로그인해 주세요.' };
}

export async function logout(): Promise<AuthState> {
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return { error: '로그아웃하지 못했습니다. 다시 시도해 주세요.' };
  } catch { return unavailable; }
  revalidatePath('/', 'layout');
  redirect('/login');
}
