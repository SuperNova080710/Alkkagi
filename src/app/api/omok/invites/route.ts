import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokUuid, omokRpcError } from '@/lib/omok/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET() {
  if(!await getVerifiedUser())return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  try {
    const {data,error}=await (await createClient()).rpc('list_omok_received_invites');
    if(error){const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}

export async function POST(request:NextRequest) {
  if(!await getVerifiedUser())return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  let payload:unknown;
  try{payload=await request.json();}catch{return NextResponse.json({error:'INVALID_REQUEST'},{status:400});}
  const input=payload && typeof payload==='object' && !Array.isArray(payload)?
    payload as Record<string,unknown>:null;
  if(!input || !isOmokUuid(input.roomId) || !isOmokUuid(input.targetId))
    return NextResponse.json({error:'INVALID_ROOM_INVITE'},{status:400});
  try {
    const {data,error}=await (await createClient()).rpc('send_omok_friend_invite',{
      p_room_id:input.roomId,p_target_id:input.targetId,
    });
    if(error){const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
