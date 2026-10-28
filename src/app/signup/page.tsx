import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getVerifiedUser } from '@/lib/auth/user';
import { getSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default async function Signup() {
  if (await getVerifiedUser()) redirect('/lobby');
  return <main className="mx-auto max-w-md px-6 py-16">
    <Link href="/" className="text-sm font-bold tracking-widest text-emerald-300">ALKKAGI ARENA</Link>
    <h1 className="mt-8 text-3xl font-bold">첫 승부를 위한 첫걸음</h1>
    <p className="mt-3 text-slate-300">이메일로 계정을 만들어 주세요.</p>
    <AuthForm mode="signup" enabled={Boolean(getSupabaseConfig())} />
  </main>;
}
