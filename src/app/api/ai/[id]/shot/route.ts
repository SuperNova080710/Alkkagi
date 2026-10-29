import {NextResponse,type NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {chooseAiShot,AI_BOT_ID} from '@/lib/ai/bot';
import {outcome,simulateShotWithFrames,validBoard} from '@/lib/game/engine';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
 const {id}=await params;
 if(!uuid.test(id))return NextResponse.json({error:'INVALID_AI_ROOM'},{status:400});
 let payload:unknown;
 try{payload=await request.json();}catch{return NextResponse.json({error:'INVALID_REQUEST'},{status:400});}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))
  return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
 const body=payload as Record<string,unknown>;
 if(typeof body.pieceId!=='string'||typeof body.turnNo!=='number'||
  !Number.isInteger(body.turnNo)||body.turnNo<1||typeof body.dx!=='number'||typeof body.dy!=='number')
  return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
 const db=await createClient();
 const {data:game,error}=await db.from('ai_matches')
  .select('room_id,owner_id,difficulty,status,turn_no,board_state')
  .eq('room_id',id).maybeSingle();
 if(error||!game||game.owner_id!==user.id)return NextResponse.json({error:'NOT_FOUND'},{status:404});
 if(game.status!=='active'||game.turn_no!==body.turnNo)
  return NextResponse.json({error:'STALE_AI_TURN'},{status:409});
 if(!validBoard(game.board_state))return NextResponse.json({error:'INVALID_BOARD'},{status:500});
 const admin=createAdminClient();
 const {data:allowed,error:throttleError}=await admin.rpc('claim_shot_slot',{p_user:user.id});
 if(throttleError)return NextResponse.json({error:'RATE_SERVICE_UNAVAILABLE'},{status:503});
 if(!allowed)return NextResponse.json({error:'TOO_MANY_SHOTS'},{status:429});
 try{
  const humanShot={pieceId:body.pieceId,dx:body.dx,dy:body.dy} as {pieceId:string;dx:number;dy:number};
  const human=simulateShotWithFrames(game.board_state,user.id,humanShot);
  let final=human.board;
  let ended=outcome(final,user.id,AI_BOT_ID);
  let aiInput:null|{pieceId:string;dx:number;dy:number}=null;
  let aiFrames:null|typeof human.frames=null;
  if(!ended.finished){
   aiInput=chooseAiShot(final,user.id,game.difficulty,game.turn_no);
   const ai=simulateShotWithFrames(final,AI_BOT_ID,aiInput);
   aiFrames=ai.frames;final=ai.board;
   ended=outcome(final,user.id,AI_BOT_ID);
  }
  const {error:commitError}=await admin.rpc('commit_ai_turn',{
   p_room_id:id,p_actor:user.id,p_turn:game.turn_no,p_expected:game.board_state,
   p_human_input:humanShot,p_human_frames:human.frames,
   p_ai_input:aiInput,p_ai_frames:aiFrames,p_final:final,
   p_finished:ended.finished,p_winner:ended.winnerId,
  });
  if(commitError)return NextResponse.json({error:'AI_TURN_CONFLICT'},{status:409});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  const reason=e instanceof Error?e.message:'AI_SHOT_FAILED';
  const inputErrors=['INVALID_SHOT','INVALID_FORCE','NOT_YOUR_PIECE'];
  return NextResponse.json({error:reason},{status:inputErrors.includes(reason)?400:503});
 }
}
