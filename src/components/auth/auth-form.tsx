'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { login, signup } from '@/app/auth/actions';
import type { AuthState } from '@/lib/auth/validation';

export function AuthForm({ mode, enabled }: { mode: 'login' | 'signup'; enabled: boolean }) {
  const isSignup = mode === 'signup';
  const [state, action, pending] = useActionState<AuthState, FormData>(isSignup ? signup : login, {});
  const inputClass = 'mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-white focus:outline-2 focus:outline-offset-2 focus:outline-emerald-300';
  return (
    <form action={action} className="mt-8 space-y-5">
      <fieldset disabled={pending || !enabled} className="space-y-5 disabled:opacity-60">
        <div>
          <label htmlFor="email" className="text-sm font-semibold">이메일</label>
          <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-semibold">비밀번호</label>
          <input id="password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 8 : 1} maxLength={128} required className={inputClass} aria-describedby={isSignup ? 'password-help' : undefined} />
          {isSignup && <p id="password-help" className="mt-2 text-sm text-slate-400">8~128자로 입력해 주세요.</p>}
        </div>
        {isSignup && <div>
          <label htmlFor="passwordConfirm" className="text-sm font-semibold">비밀번호 확인</label>
          <input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={inputClass} />
        </div>}
        <button className="w-full rounded-lg bg-emerald-300 px-4 py-3 font-bold text-slate-950 disabled:cursor-wait" disabled={pending}>
          {pending ? '처리 중…' : isSignup ? '회원가입' : '로그인'}
        </button>
      </fieldset>
      {!enabled && <p role="status" className="text-amber-200">인증 서비스를 준비 중입니다. 잠시 후 다시 방문해 주세요.</p>}
      {state.error && <p role="alert" className="text-rose-300">{state.error}</p>}
      {state.message && <p role="status" className="leading-7 text-emerald-200">{state.message}</p>}
      <p className="text-sm text-slate-300">
        {isSignup ? '이미 계정이 있으신가요? ' : '처음 오셨나요? '}
        <Link className="text-emerald-300 underline underline-offset-4" href={isSignup ? '/login' : '/signup'}>{isSignup ? '로그인' : '회원가입'}</Link>
      </p>
    </form>
  );
}
