import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { omokRpcError } from '@/lib/omok/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET() {
  if(!await getVerifiedUser()) return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  try {
    const {data,error}=await (await createClient()).rpc('omok_ranked_queue_status');
    if(error){const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}

export async function POST(request:NextRequest) {
  if(!await getVerifiedUser()) return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  let payload:unknown;
  try{payload=await request.json();}catch{return NextResponse.json({error:'INVALID_REQUEST'},{status:400});}
  const intent=payload && typeof payload==='object' && !Array.isArray(payload)?
    (payload as Record<string,unknown>).intent:null;
  if(intent!=='join'&&intent!=='cancel')return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
  try{
    const db=await createClient();
    const {data,error}=await db.rpc(intent==='join'?'join_omok_ranked_queue':'cancel_omok_ranked_queue');
    if(error){const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data:intent==='cancel'?{status:'idle',matchId:null}:data},
      {headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
