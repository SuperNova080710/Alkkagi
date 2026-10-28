import Link from 'next/link';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {NicknameForm} from '@/components/profile/nickname-form';
export const dynamic='force-dynamic';
export default async function ProfilePage(){
 const user=await requireUser();
 const {data:profile,error}=await (await createClient())
  .from('profiles').select('nickname,rating').eq('id',user.id).maybeSingle();
 if(error||!profile)return <main className="mx-auto max-w-2xl px-6 py-12">
  <Link href="/lobby" className="text-emerald-300">← 로비</Link>
  <p className="mt-8" role="alert">프로필을 불러오지 못했습니다. 다시 로그인해 주세요.</p>
 </main>;
 return <main className="mx-auto max-w-2xl px-6 py-12">
  <Link href="/lobby" className="text-sm font-bold text-emerald-300">← 대전 로비</Link>
  <h1 className="mt-10 text-3xl font-black">내 닉네임 설정</h1>
  <p className="mt-3 text-slate-300">닉네임은 대전 화면, 턴 로그, 랭크 순위표와 경기 기록에 표시됩니다.</p>
  <div className="mt-7 rounded-xl border border-slate-700 bg-slate-900 px-5 py-4">
   <p className="text-xs text-slate-400">현재 닉네임</p>
   <p className="mt-1 break-all text-xl font-bold">{profile.nickname}</p>
   <p className="mt-2 text-sm text-slate-400">현재 RP {profile.rating.toLocaleString()}</p>
  </div>
  <NicknameForm initial={profile.nickname}/>
 </main>;
}
