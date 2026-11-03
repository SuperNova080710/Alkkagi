import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {validBoard} from '@/lib/game/engine';
import {DIFFICULTY_LABELS,isAiDifficulty} from '@/lib/ai/bot';
import {AiGameBoard,type AiGame,type AiTurn} from '@/components/game/ai-game-board';
export const dynamic='force-dynamic';
export default async function AiRoomPage({params}:{params:Promise<{id:string}>}){
 const user=await requireUser(),{id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const [{data:raw},{data:profile}]=await Promise.all([
  db.from('ai_matches').select('room_id,owner_id,difficulty,status,board_state,turn_no,winner_id')
    .eq('room_id',id).maybeSingle(),
  db.from('profiles').select('nickname').eq('id',user.id).maybeSingle(),
 ]);
 if(!raw||raw.owner_id!==user.id||!validBoard(raw.board_state)||
   !isAiDifficulty(raw.difficulty))notFound();
 const {data:history}=await db.from('ai_turns')
  .select('turn_no,human_input,human_frames,ai_input,ai_frames')
  .eq('room_id',id).order('turn_no',{ascending:false}).limit(50);
 const game=raw as AiGame;
 return <div className="arena arena-match"><main className="game-page game-page--playing mx-auto max-w-6xl px-4 py-4 sm:px-6">
  <Link href="/lobby" className="game-page-back text-sm font-semibold text-emerald-300">← 로비</Link>
  <div className="game-page-header mt-8 flex flex-wrap items-center justify-between gap-4">
   <div><p className="text-sm font-bold tracking-widest text-sky-300">SOLO PRACTICE · RP 미반영</p>
    <h1 className="mt-3 text-4xl font-black">AI 알까기</h1></div>
   <span className="rounded-lg bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-200">
    난이도 {DIFFICULTY_LABELS[game.difficulty]}</span>
  </div>
  <AiGameBoard key={game.room_id} game={game} nickname={profile?.nickname??'나'}
   turns={((history??[]) as AiTurn[]).reverse()}
   cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}/>
 </main></div>;
}
