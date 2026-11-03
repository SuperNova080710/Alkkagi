import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokAiDifficulty } from '@/lib/omok/ai';
import { omokRpcError } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!await getVerifiedUser()) return NextResponse.json({ error:'AUTH_REQUIRED' }, { status:401 });
  let payload: unknown;
  try { payload=await request.json(); } catch { return NextResponse.json({error:'INVALID_REQUEST'}, {status:400}); }
  const difficulty=payload && typeof payload==='object' && !Array.isArray(payload) ?
    (payload as Record<string,unknown>).difficulty : null;
  if (!isOmokAiDifficulty(difficulty))
    return NextResponse.json({error:'INVALID_DIFFICULTY'}, {status:400});
  try {
    const {data,error}=await (await createClient()).rpc('create_omok_ai_match',{p_difficulty:difficulty});
    if(error) { const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status}); }
    return NextResponse.json({data:{matchId:data}},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503}); }
}
