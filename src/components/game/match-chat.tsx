'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {createBrowserClient} from '@supabase/ssr';
import {sendMatchMessage} from '@/app/matches/chat-actions';

export type MatchMessage={id:string;sender_id:string;body:string;created_at:string};
type Props={
 matchId:string;
 userId:string;
 firstPlayerId:string;
 secondPlayerId:string;
 players:{seat:number;nickname:string}[];
 messages:MatchMessage[];
 status:string;
};
export function MatchChat({matchId,userId,firstPlayerId,secondPlayerId,players,messages,status}:Props){
 const router=useRouter();
 const [draft,setDraft]=useState('');
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const listRef=useRef<HTMLOListElement>(null);
 const closed=status!=='active'&&status!=='finished';
 useEffect(()=>{
  if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;
 },[messages]);
 useEffect(()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return;
  const db=createBrowserClient(url,key);
  const channel=db.channel('match-chat:'+matchId).on('postgres_changes',{
   event:'INSERT',schema:'public',table:'match_messages',filter:'match_id=eq.'+matchId,
  },()=>router.refresh()).subscribe();
  return ()=>{void db.removeChannel(channel);};
 },[matchId,router]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(sending||closed||!draft.trim())return;
  setSending(true);
  setError('');
  try{
   const result=await sendMatchMessage(matchId,draft);
   if(result.ok){setDraft('');router.refresh();}
   else setError(result.message);
  }catch{setError('채팅을 전송하지 못했습니다.');}
  finally{setSending(false);}
 }
 function nickname(user:string){
  const seat=user===firstPlayerId?1:user===secondPlayerId?2:0;
  return players.find(p=>p.seat===seat)?.nickname??'플레이어';
 }
 return <aside className="game-chat-panel rounded-2xl border border-slate-700 bg-slate-900/95 p-4"
   aria-label="경기 참가자 채팅">
  <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-3">
   <h3 className="font-bold">대전 채팅</h3>
   <span className="text-xs text-slate-400">두 참가자만</span>
  </div>
  <ol className="game-chat-messages mt-3 space-y-3 pr-1" ref={listRef} aria-label="채팅 메시지"
   aria-live="polite" aria-relevant="additions text">
   {messages.length===0&&<li className="rounded-xl bg-slate-800/60 p-3 text-xs leading-5 text-slate-400">
    상대방에게 인사해 보세요. 이 경기의 두 참가자만 채팅을 볼 수 있습니다.
   </li>}
   {messages.map(m=><li key={m.id} className={'flex flex-col '+(m.sender_id===userId?'items-end':'items-start')}>
    <p className="max-w-full truncate text-xs text-slate-400" title={nickname(m.sender_id)}>
     {m.sender_id===userId?'나':nickname(m.sender_id)}
    </p>
    <div className={'mt-1 max-w-full break-words rounded-xl px-3 py-2 text-sm leading-5 '+
     (m.sender_id===userId?'bg-emerald-800/90 text-emerald-50':'bg-slate-800 text-slate-100')}>
     {m.body}
    </div>
   </li>)}
  </ol>
  <form onSubmit={submit} className="game-chat-compose mt-3 border-t border-slate-700 pt-3">
   <label className="sr-only" htmlFor={'match-chat-'+matchId}>채팅 메시지</label>
   <textarea id={'match-chat-'+matchId} value={draft} onChange={e=>{setDraft(e.target.value);setError('');}}
    maxLength={280} rows={2} disabled={sending||closed} placeholder={closed?'종료된 채팅입니다':'상대방에게 메시지 보내기'}
    className="w-full resize-none rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm outline-offset-2 focus:outline-emerald-300 disabled:opacity-60"/>
   <div className="mt-2 flex items-center justify-between gap-2">
    <span className="text-xs tabular-nums text-slate-500">{draft.length}/280</span>
    <button type="submit" disabled={sending||closed||!draft.trim()}
     className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">
     {sending?'전송 중…':'전송'}
    </button>
   </div>
   {error&&<p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
   {status==='finished'&&!closed&&<p className="mt-2 text-xs text-slate-400">경기 종료 후 30분까지 채팅할 수 있습니다.</p>}
  </form>
 </aside>;
}
