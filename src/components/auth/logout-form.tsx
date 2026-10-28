'use client';
import { useActionState } from 'react';
import { logout } from '@/app/auth/actions';

export function LogoutForm() {
  const [state, action, pending] = useActionState(logout, {});
  return <form action={action}>
    <button disabled={pending} className="rounded-lg border border-slate-600 px-4 py-2 text-sm disabled:opacity-60">{pending ? '로그아웃 중…' : '로그아웃'}</button>
    {state.error && <p role="alert" className="mt-3 text-rose-300">{state.error}</p>}
  </form>;
}
