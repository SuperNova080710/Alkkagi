import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {validBoard} from '@/lib/game/engine';
import {GameBoard} from '@/components/game/game-board';
import {type TurnShot} from '@/lib/game/turn-history';
export const dynamic='force-dynamic';
export default async function RankedMatchPage({params}:{params:Promise<{id:string}>}){
 const user=await requireUser();
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await createClient();
 const {data:match}=await db.from('matches')
  .select('id,status,turn_user_id,turn_no,player1_id,player2_id,winner_id,board_state,mode,turn_deadline,finished_at')
  .eq('id',id).eq('mode','ranked').maybeSingle();
 if(!match||!validBoard(match.board_state))notFound();
 const [{data:playersData},{data:history},{data:chatHistory},{data:ratingData}]=await Promise.all([
  db.rpc('ranked_match_players',{p_match_id:id}),
  db.from('shots').select('id,turn_no,player_id,piece_id,input,result_state,created_at')
   .eq('match_id',id).order('turn_no',{ascending:false}).limit(100),
  db.from('match_messages').select('id,sender_id,body,created_at').eq('match_id',id)
   .order('created_at',{ascending:false}).limit(100),
  db.from('rating_history').select('before_rating,after_rating,delta')
   .eq('match_id',id).eq('user_id',user.id).maybeSingle(),
 ]);
 const players=Array.isArray(playersData)?playersData as {seat:number;nickname:string}[]:[
  {seat:1,nickname:'선공'},{seat:2,nickname:'후공'},
 ];
 const shots=((history??[]) as TurnShot[]).reverse();
 const messages=((chatHistory??[]) as import('@/components/game/match-chat').MatchMessage[]).reverse();
 return <div className="arena arena-match"><main className="game-page game-page--playing mx-auto max-w-6xl px-4 py-4 sm:px-6">
  <Link href="/ranked" className="game-page-back text-sm font-semibold text-emerald-300">← 랭크 로비</Link>
  <div className="game-page-header mt-8 flex flex-wrap items-center justify-between gap-4">
   <div><p className="text-sm font-bold tracking-widest text-amber-300">RANKED · RP 대전</p>
    <h1 className="mt-3 text-4xl font-black">랭크 알까기</h1></div>
   <span className="rounded-lg bg-amber-900/40 px-4 py-2 text-sm font-semibold text-amber-200">랭크 포인트 대전</span>
  </div>
  <GameBoard key={match.id} match={{...match,board_state:match.board_state}} userId={user.id}
   roomId={id} players={players} rematchReadyCount={0} myRematchVote={false} shots={shots} messages={messages} rating={ratingData} mode="ranked"
 cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}/>
 </main></div>;
}
