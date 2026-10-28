import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export async function getVerifiedUser() {
  if (!getSupabaseConfig()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getVerifiedUser();
  if (!user) redirect('/login');
  return user;
}
