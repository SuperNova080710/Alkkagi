import Link from 'next/link';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {RankedQueue} from '@/components/ranked/ranked-queue';
import {type QueueStatus} from '@/app/ranked/actions';
export const dynamic='force-dynamic';
type Entry={position:number;nickname:string;rating:number;wins:number;losses:number;draws:number};
type History={matchId:string;finished_at:string;opponent:string;result:string;delta:number|null;ratingAfter:number|null};
type Dashboard={rating:number;rank:number;wins:number;losses:number;draws:number;leaderboard:Entry[];history:History[]};
const empty:Dashboard={rating:1000,rank:0,wins:0,losses:0,draws:0,leaderboard:[],history:[]};
export default async function RankedPage(){
 await requireUser();
 const db=await createClient();
 const [statusQuery,boardQuery]=await Promise.all([
  db.rpc('ranked_queue_status'),db.rpc('ranked_dashboard'),
 ]);
 const raw=statusQuery.data as {status?:string;matchId?:unknown}|null;
 const status:QueueStatus={
  status:raw?.status==='queued'||raw?.status==='matched'?raw.status:'idle',
  matchId:typeof raw?.matchId==='string'?raw.matchId:null,
 };
 const dashboard=(boardQuery.data??empty) as Dashboard;
 return <main className="mx-auto max-w-5xl px-5 py-12">
  <Link href="/lobby" className="text-sm font-semibold text-emerald-300">← 일반전 로비</Link>
  <h1 className="mt-8 text-4xl font-black">랭크 아레나</h1>
  <p className="mt-3 text-slate-300">승리하면 RP를 획득하고 패배하면 RP가 감소합니다. 일반전 결과는 반영되지 않습니다.</p>
  <div className="mt-6 grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl border border-slate-700 bg-slate-900 p-5"><p className="text-sm text-slate-400">나의 RP</p>
    <p className="mt-2 text-3xl font-black text-emerald-300">{dashboard.rating.toLocaleString()}</p></div>
   <div className="rounded-xl border border-slate-700 bg-slate-900 p-5"><p className="text-sm text-slate-400">전체 순위</p>
    <p className="mt-2 text-3xl font-black">{dashboard.rank>0?'#'+dashboard.rank:'—'}</p></div>
   <div className="rounded-xl border border-slate-700 bg-slate-900 p-5"><p className="text-sm text-slate-400">랭크 전적</p>
    <p className="mt-2 text-2xl font-bold">{dashboard.wins}승 · {dashboard.losses}패 · {dashboard.draws}무</p></div>
  </div>
  <RankedQueue initial={status}/>
  <section className="mt-9 grid gap-7 lg:grid-cols-2">
   <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
    <h2 className="text-xl font-bold">리더보드 TOP 100</h2>
    <div className="mt-4 max-h-[400px] overflow-auto">
     <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-900">
      <tr className="text-slate-400"><th className="p-2">순위</th><th className="p-2">닉네임</th><th className="p-2 text-right">RP</th></tr>
     </thead><tbody>{(dashboard.leaderboard??[]).map(p=><tr key={p.position} className="border-t border-slate-800">
      <td className="p-2">{p.position}</td><td className="max-w-32 truncate p-2">{p.nickname}</td>
      <td className="p-2 text-right font-semibold text-emerald-300">{p.rating}</td>
     </tr>)}</tbody></table>
    </div>
   </div>
   <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
    <h2 className="text-xl font-bold">최근 랭크 경기</h2>
    <ol className="mt-4 max-h-[400px] space-y-2 overflow-auto text-sm">
     {(dashboard.history??[]).length===0&&<li className="text-slate-400">아직 랭크 경기 기록이 없습니다.</li>}
     {(dashboard.history??[]).map(h=><li key={h.matchId} className="rounded-lg bg-slate-800 p-3">
      <div className="flex items-center justify-between"><span className="font-semibold">{h.opponent}</span>
       <span className={h.result==='win'?'text-emerald-300':h.result==='loss'?'text-rose-300':'text-slate-200'}>
        {h.result==='win'?'승리':h.result==='loss'?'패배':'무승부'}</span></div>
      <p className="mt-1 text-xs text-slate-300">RP {h.delta===null?'정산 확인 중':(h.delta>=0?'+':'')+h.delta} · {new Date(h.finished_at).toLocaleDateString('ko-KR')}</p>
     </li>)}
    </ol>
   </div>
  </section>
 </main>;
}
