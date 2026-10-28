'use client';
import {useActionState} from 'react';
import {createRoom,joinRoom} from '@/app/rooms/actions';
export function RoomForms(){
 const [c,ca,cp]=useActionState(createRoom,{error:''});
 const [j,ja,jp]=useActionState(joinRoom,{error:''});
 return <div className="mt-8 grid gap-5 sm:grid-cols-2">
 <form action={ca} className="rounded-xl border border-slate-600 p-6">
 <h2 className="text-xl font-bold">방 만들기</h2>
 <p className="mt-3 text-slate-300">친구에게 전달할 8자리 초대 코드를 생성합니다.</p>
 <button disabled={cp} className="mt-5 rounded-lg bg-emerald-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{cp?'생성 중…':'방 생성'}</button>
 {c.error&&<p role="alert" className="mt-3 text-rose-300">{c.error}</p>}
 </form>
 <form action={ja} className="rounded-xl border border-slate-600 p-6">
 <h2 className="text-xl font-bold">방 참가하기</h2>
 <label htmlFor="invite" className="mt-3 block text-slate-300">초대 코드</label>
 <input id="invite" name="code" required maxLength={20} placeholder="ABCDEFGH" className="mt-2 block w-full rounded-lg border border-slate-500 bg-slate-900 p-3 uppercase" />
 <button disabled={jp} className="mt-4 rounded-lg border border-emerald-300 px-5 py-3 font-bold text-emerald-300 disabled:opacity-50">{jp?'참가 중…':'방 참가'}</button>
 {j.error&&<p role="alert" className="mt-3 text-rose-300">{j.error}</p>}
 </form></div>;
}
