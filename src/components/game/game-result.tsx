'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {changeRankedQueue} from '@/app/ranked/actions';

export type RatingChange={before_rating:number;after_rating:number;delta:number};
type Props={
 mode:'casual'|'ranked';
 matchId:string;
 roomId:string;
 winnerId:string|null;
 userId:string;
 rating:RatingChange|null;
 rematchReadyCount:number;
 myRematchVote:boolean;
 rematchAction:(payload:FormData)=>void;
 rematchPending:boolean;
 rematchError:string;
 animating:boolean;
};

export function GameResult({mode,roomId,winnerId,userId,rating,rematchReadyCount,
 myRematchVote,rematchAction,rematchPending,rematchError,animating}:Props){
 const router=useRouter();
 const [matching,setMatching]=useState(false);
 const [error,setError]=useState('');
 const outcome=winnerId===null?'무승부':winnerId===userId?'승리':'패배';
 const emphasis=outcome==='승리'?'text-emerald-300':outcome==='패배'?'text-rose-300':'text-amber-200';
 async function challengeAgain(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(matching)return;
  setMatching(true);setError('');
  try{
   const response=await changeRankedQueue('join');
   if(response.error){setError(response.error);return;}
   router.push(response.status==='matched'&&response.matchId?'/ranked/'+response.matchId:'/ranked');
   router.refresh();
  }catch{setError('새 랭크 매칭을 시작하지 못했습니다.');}
  finally{setMatching(false);}
 }
 return <div className="game-result-overlay absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3">
  <div className="game-result-card w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-950/95 p-5 text-center shadow-2xl sm:p-6"
   role="status" aria-live="polite">
   <p className="text-xs font-bold tracking-[0.2em] text-slate-400">MATCH RESULT</p>
   <h3 className={'mt-2 text-4xl font-black '+emphasis}>{outcome}</h3>
   <p className="mt-2 text-sm text-slate-300">
    {outcome==='승리'?'상대방을 이겼습니다.':outcome==='패배'?'상대방이 승리했습니다.':'서로 비겼습니다.'}
   </p>
   {mode==='ranked'&&<div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
    <p className="text-xs text-slate-400">이번 경기 RP 변동</p>
    {rating?<><p className={'mt-1 text-2xl font-black tabular-nums '+
      (rating.delta>=0?'text-emerald-300':'text-rose-300')}>
       {rating.delta>0?'+':''}{rating.delta} RP
     </p><p className="mt-1 text-sm tabular-nums text-slate-300">
      {rating.before_rating.toLocaleString()} → {rating.after_rating.toLocaleString()} RP
     </p></>:<p className="mt-2 text-sm text-amber-200">정산 결과 확인 중입니다.</p>}
   </div>}
   <div className="mt-4 flex flex-col gap-2">
    <Link href={mode==='ranked'?'/ranked':'/lobby'}
     className="rounded-xl border border-slate-500 px-4 py-2.5 text-sm font-semibold text-slate-100">
      로비로 돌아가기
    </Link>
    {mode==='casual'?<form action={rematchAction}>
     <input name="roomId" type="hidden" value={roomId}/>
     <button type="submit" disabled={rematchPending||myRematchVote||animating}
      className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
      {rematchPending?'요청 중…':myRematchVote?'상대 수락 대기 중':'재도전 · 다시하기'}
     </button>
     <p className="mt-2 text-xs text-slate-400">양쪽 모두 수락하면 재대전 · {rematchReadyCount}/2</p>
     {rematchError&&<p className="mt-1 text-xs text-rose-300" role="alert">{rematchError}</p>}
    </form>:<form onSubmit={challengeAgain}>
     <button disabled={matching} type="submit" className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
      {matching?'매칭 시작 중…':'재도전 · 새 랭크 매칭'}
     </button>
     {error&&<p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
    </form>}
   </div>
  </div>
 </div>;
}
