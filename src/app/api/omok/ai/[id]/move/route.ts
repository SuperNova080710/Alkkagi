import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseOmokMove, isOmokUuid, omokRpcError } from '@/lib/omok/http';
import { chooseOmokAiMove, isOmokAiDifficulty } from '@/lib/omok/ai';
import { hasFive, validOmokBoard } from '@/lib/omok/engine';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getVerifiedUser();
  if(!user) return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  const {id}=await params;
  if(!isOmokUuid(id)) return NextResponse.json({error:'INVALID_MATCH'},{status:400});
  let payload:unknown;
  try{payload=await request.json();}catch{
    return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
  }
  const move=parseOmokMove(payload);
  if(!move || move.turnNo>113) return NextResponse.json({error:'INVALID_MOVE'},{status:400});
  try {
    const db=await createClient();
    const {data:game,error}=await db.from('omok_ai_matches')
      .select('owner_id,difficulty,turn_no,board_state,status,winner,finish_reason')
      .eq('id',id).maybeSingle();
    if(error) return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});
    if(!game || game.owner_id!==user.id)
      return NextResponse.json({error:'MATCH_NOT_FOUND'},{status:404});

    // Retries after an accepted turn must not trigger another AI calculation.
    const {data:previous,error:previousError}=await db.from('omok_ai_turns')
      .select('turn_no,human_row,human_col').eq('match_id',id)
      .eq('request_id',move.requestId).maybeSingle();
    if(previousError) return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});
    if(previous) {
      if(previous.turn_no!==move.turnNo || previous.human_row!==move.row ||
          previous.human_col!==move.col)
        return NextResponse.json({error:'REQUEST_CONFLICT'},{status:409});
      return NextResponse.json({data:{boardState:game.board_state,turnNo:game.turn_no,
        status:game.status,winner:game.winner,finishReason:game.finish_reason,replayed:true}},
        {headers:{'Cache-Control':'no-store'}});
    }

    if(game.status!=='active' || game.turn_no!==move.turnNo)
      return NextResponse.json({error:'STALE_TURN'},{status:409});
    if(!validOmokBoard(game.board_state))
      return NextResponse.json({error:'INVALID_BOARD'},{status:503});
    if(!isOmokAiDifficulty(game.difficulty))
      return NextResponse.json({error:'INVALID_DIFFICULTY'},{status:503});
    if(game.board_state[move.row][move.col]!==null)
      return NextResponse.json({error:'CELL_OCCUPIED'},{status:409});

    const afterHuman=game.board_state.map(row=>[...row]);
    afterHuman[move.row][move.col]='black';
    const humanWin=hasFive(afterHuman,move.row,move.col,'black');
    const aiMove=humanWin || game.turn_no===113 ? null :
      chooseOmokAiMove(afterHuman,'white',game.difficulty,game.turn_no);
    // The service-role RPC uses a row lock and recomputes both results.
    // The client never chooses an AI move or supplies the board.
    const {data,result,error:commitError}=await (async()=>{
      const r=await createAdminClient().rpc('commit_omok_ai_turn',{
        p_match_id:id,p_actor:user.id,p_request_id:move.requestId,
        p_turn:move.turnNo,p_expected_board:game.board_state,
        p_human_row:move.row,p_human_col:move.col,
        p_ai_row:aiMove?.row??null,p_ai_col:aiMove?.col??null,
      });
      return {data:r.data,result:r.data,error:r.error};
    })();
    void result;
    if(commitError){const failure=omokRpcError(commitError);
      return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
