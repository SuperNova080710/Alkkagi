import Link from 'next/link';
import { requireUser } from '@/lib/auth/user';
import { LogoutForm } from '@/components/auth/logout-form';

export const dynamic = 'force-dynamic';

export default async function Lobby() {
  const user = await requireUser();
  return <main className="mx-auto max-w-3xl px-6 py-16">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="text-sm font-bold tracking-widest text-emerald-300">ALKKAGI ARENA</Link>
      <LogoutForm />
    </header>
    <h1 className="mt-12 text-4xl font-bold">대전 로비</h1>
    <p className="mt-4 break-all text-slate-300">{user.email} 계정으로 로그인했습니다.</p>
    <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <h2 className="text-xl font-bold">대전 기능을 준비하고 있습니다</h2>
      <p className="mt-3 leading-7 text-slate-300">방 만들기와 초대 코드 참가 기능은 다음 업데이트에서 제공됩니다.</p>
    </section>
  </main>;
}
