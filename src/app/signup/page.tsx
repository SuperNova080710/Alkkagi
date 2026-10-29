import { ArenaShell } from '@/components/ui/arena';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getVerifiedUser } from '@/lib/auth/user';
import { getSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default async function Signup() {
  if (await getVerifiedUser()) redirect('/lobby');
  return <ArenaShell><section className="arena-auth"><div className="arena-auth-art" aria-hidden="true" /><div className="arena-auth-form">
    <p className="arena-section-kicker">ALKKAGI ARENA</p>
    <h1 className="mt-8 text-3xl font-bold">첫 승부를 위한 첫걸음</h1>
    <p className="mt-3 text-slate-300">이메일로 계정을 만들어 주세요.</p>
    <AuthForm mode="signup" enabled={Boolean(getSupabaseConfig())} />
  </div></section></ArenaShell>;
}
