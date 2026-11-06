import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokUuid } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  if(!await getVerifiedUser()) return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  const {id}=await params;
  if(!isOmokUuid(id)) return NextResponse.json({error:'INVALID_MATCH'},{status:400});
  try {
    const db=await createClient();
    const {data:match,error}=await db.from('omok_ai_matches')
      .select('id,difficulty,turn_no,board_state,rule_set,status,winner,finish_reason,created_at,finished_at')
      .eq('id',id).maybeSingle();
    if(error) return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});
    if(!match) return NextResponse.json({error:'MATCH_NOT_FOUND'},{status:404});
    const history=await db.from('omok_ai_turns')
      .select('turn_no,human_row,human_col,ai_row,ai_col,created_at')
      .eq('match_id',id).order('turn_no',{ascending:true}).limit(113);
    if(history.error) return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});
    return NextResponse.json({data:{match,turns:history.data??[]}},
      {headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
