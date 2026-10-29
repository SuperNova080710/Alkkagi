'use client';
import {useActionState} from 'react';
import {addAiOpponent} from '@/app/rooms/ai-actions';
import {AI_DIFFICULTIES,DIFFICULTY_LABELS} from '@/lib/ai/bot';
export function AddAiOpponent({roomId}:{roomId:string}){
 const [state,action,pending]=useActionState(addAiOpponent,{error:''});
 return <form action={action} className="mt-5 rounded-xl border border-sky-500/50 bg-sky-950/20 p-4">
  <h3 className="text-lg font-bold">AI 상대 추가</h3>
  <p className="mt-1 text-sm text-slate-300">친구를 기다리는 대신 AI와 연습할 수 있습니다. 랭크 RP에는 반영되지 않습니다.</p>
  <input type="hidden" name="roomId" value={roomId}/>
  <fieldset className="mt-4">
   <legend className="text-sm font-semibold">AI 난이도</legend>
   <div className="mt-2 flex flex-wrap gap-3">
    {AI_DIFFICULTIES.map(difficulty=><label key={difficulty} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm">
     <input type="radio" name="difficulty" value={difficulty} defaultChecked={difficulty==='normal'}
      className="accent-emerald-300"/>{DIFFICULTY_LABELS[difficulty]}
    </label>)}
   </div>
  </fieldset>
  <button type="submit" disabled={pending} className="mt-4 rounded-xl bg-sky-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">
   {pending?'AI 대전 준비 중…':'확인 · AI 대전 시작'}
  </button>
  {state.error&&<p role="alert" className="mt-3 text-sm text-rose-300">{state.error}</p>}
 </form>;
}
