import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getVerifiedUser } from '@/lib/auth/user';
import { getSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getVerifiedUser()) redirect('/lobby');
  const params = await searchParams;
  return <main className="mx-auto max-w-md px-6 py-16">
    <Link href="/" className="text-sm font-bold tracking-widest text-emerald-300">ALKKAGI ARENA</Link>
    <h1 className="mt-8 text-3xl font-bold">다시 오셨군요</h1>
    <p className="mt-3 text-slate-300">로그인하고 대전을 준비하세요.</p>
    {params.error === 'callback' && <p role="alert" className="mt-4 text-rose-300">인증 링크가 만료되었거나 유효하지 않습니다. 이메일 인증이 완료됐다면 로그인해 주세요. 링크는 가입한 브라우저에서 열어 주세요.</p>}
    <AuthForm mode="login" enabled={Boolean(getSupabaseConfig())} />
  </main>;
}
