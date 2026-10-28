import Link from 'next/link';
import {requireUser} from '@/lib/auth/user';
import {LogoutForm} from '@/components/auth/logout-form';
import {RoomForms} from '@/components/rooms/room-forms';
export const dynamic='force-dynamic';
export default async function Lobby(){
 const user=await requireUser();
 return <main className="mx-auto max-w-4xl px-6 py-16">
 <header className="flex items-center justify-between gap-4"><Link href="/" className="font-bold text-emerald-300">ALKKAGI ARENA</Link><LogoutForm /></header>
 <h1 className="mt-12 text-4xl font-bold">대전 로비</h1>
 <p className="mt-4 break-all text-slate-300">{user.email} 계정으로 로그인했습니다.</p>
 <RoomForms />
 <p className="mt-8 text-slate-400">현재 초대방 입장까지 지원합니다. 알까기 플레이는 후속 단계에서 추가됩니다.</p>
 </main>;
}
