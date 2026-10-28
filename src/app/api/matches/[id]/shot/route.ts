import {NextResponse, type NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {outcome,simulateShotWithFrames,validBoard} from '@/lib/game/engine';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
 const {id}=await params;
 if(!uuid.test(id))return NextResponse.json({error:'INVALID_MATCH'},{status:400});
 let body:unknown;
 try{body=await request.json();}catch{return NextResponse.json({error:'INVALID_REQUEST'},{status:400});}
 if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
 const b=body as Record<string,unknown>;
 if(typeof b.pieceId!=='string'||typeof b.requestId!=='string'||!uuid.test(b.requestId)||
   typeof b.turnNo!=='number'||!Number.isInteger(b.turnNo)||b.turnNo<1||
   typeof b.dx!=='number'||typeof b.dy!=='number'){
  return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
 }
 const db=await createClient();
 const {data,error}=await db.from('matches').select('id,player1_id,player2_id,turn_user_id,turn_no,status,board_state')
  .eq('id',id).maybeSingle();
 if(error||!data)return NextResponse.json({error:'MATCH_NOT_FOUND'},{status:404});
 if(data.status!=='active'||data.turn_user_id!==user.id||data.turn_no!==b.turnNo)
   return NextResponse.json({error:'STALE_TURN'},{status:409});
 if(!validBoard(data.board_state))return NextResponse.json({error:'INVALID_BOARD'},{status:500});
 // Server-exclusive DB throttle: protects physics CPU work from rapid repeated requests.
 try{
  const {data:allowed,error:rateError}=await createAdminClient().rpc('claim_shot_slot',{p_user:user.id});
  if(rateError)return NextResponse.json({error:'RATE_SERVICE_UNAVAILABLE'},{status:503});
  if(!allowed)return NextResponse.json({error:'TOO_MANY_SHOTS'},{status:429});
 }catch{return NextResponse.json({error:'RATE_SERVICE_UNAVAILABLE'},{status:503});}
 let simulation;
 try{simulation=simulateShotWithFrames(data.board_state,user.id,{pieceId:b.pieceId,dx:b.dx,dy:b.dy});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'INVALID_SHOT'},{status:400});}
 const next=simulation.board;
 const ending=outcome(next,data.player1_id,data.player2_id);
 try{
  const {data:result,error:commitError}=await createAdminClient().rpc('commit_casual_shot',{
   p_match_id:id,p_actor:user.id,p_turn:data.turn_no,p_request:b.requestId,
   p_piece:b.pieceId,p_input:{dx:b.dx,dy:b.dy,expectedBoard:data.board_state,finished:ending.finished,frames:simulation.frames},
   p_result:next,p_winner:ending.winnerId,
  });
  if(commitError)return NextResponse.json({error:'SHOT_CONFLICT'},{status:409});
  return NextResponse.json({data:result},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'SERVER_UNAVAILABLE'},{status:503});}
}
