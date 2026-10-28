'use client';
import {useRouter} from 'next/navigation';
import {useState,useTransition} from 'react';
import {checkNickname,saveNickname} from '@/app/profile/actions';
import {nicknameError,NICKNAME_GUIDE} from '@/lib/profile/nickname';

type Verification={value:string;available:boolean;message:string};
export function NicknameForm({initial}:{initial:string}){
 const router=useRouter();
 const [current,setCurrent]=useState(initial);
 const [value,setValue]=useState(initial);
 const [verified,setVerified]=useState<Verification|null>(null);
 const [feedback,setFeedback]=useState('');
 const [busy,startTransition]=useTransition();
 const valid=nicknameError(value)==='';
 const checked=verified?.available===true&&verified.value===value;
 const changed=value!==current;
 function onInput(next:string){
  setValue(next);
  setVerified(null);
  setFeedback('');
 }
 function verify(){
  if(!valid){setFeedback(NICKNAME_GUIDE);return;}
  startTransition(async()=>{
   const result=await checkNickname(value);
   setVerified({value,available:result.success,message:result.message});
   setFeedback('');
  });
 }
 function submit(){
  if(!checked||!changed||busy)return;
  startTransition(async()=>{
   const result=await saveNickname(value);
   setFeedback(result.message);
   if(result.success&&result.nickname){
    setCurrent(result.nickname);
    setVerified(null);
    router.refresh();
   }else{
    setVerified(null);
   }
  });
 }
 return <div className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-6">
  <label htmlFor="nickname" className="block text-sm font-bold text-slate-100">변경할 닉네임</label>
  <p className="mt-1 text-sm text-slate-400">{NICKNAME_GUIDE}</p>
  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
   <input id="nickname" name="nickname" value={value} autoComplete="off" maxLength={24}
    onChange={e=>onInput(e.target.value)}
    className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 outline-offset-2 focus:outline-emerald-300"
    aria-describedby="nickname-feedback"/>
   <button type="button" onClick={verify} disabled={busy||!valid}
    className="rounded-xl border border-emerald-400 px-5 py-3 font-bold text-emerald-200 disabled:opacity-50">
    {busy?'확인 중…':'중복 확인'}
   </button>
  </div>
  <p id="nickname-feedback" className={'mt-3 min-h-6 text-sm '+
   (verified?.available?'text-emerald-300':'text-amber-200')} role="status" aria-live="polite">
   {feedback||verified?.message||(value===current?'현재 설정된 닉네임입니다.':'중복 확인을 먼저 진행해 주세요.')}
  </p>
  <button type="button" onClick={submit} disabled={!checked||!changed||busy}
   className="mt-4 rounded-xl bg-emerald-300 px-6 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
   {busy?'처리 중…':'닉네임 저장'}
  </button>
  <p className="mt-4 text-xs text-slate-400">
   중복 확인 후 저장할 수 있습니다. 저장 직전 다른 계정이 먼저 등록한 닉네임은 사용할 수 없습니다.
  </p>
 </div>;
}
