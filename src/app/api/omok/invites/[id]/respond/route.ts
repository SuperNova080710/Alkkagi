import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokUuid, omokRpcError } from '@/lib/omok/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  if(!await getVerifiedUser())return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  const {id}=await params;
  if(!isOmokUuid(id))return NextResponse.json({error:'INVALID_ROOM_INVITE'},{status:400});
  let payload:unknown;
  try{payload=await request.json();}catch{return NextResponse.json({error:'INVALID_REQUEST'},{status:400});}
  const accept=payload && typeof payload==='object' && !Array.isArray(payload)?
    (payload as Record<string,unknown>).accept:null;
  if(typeof accept!=='boolean')return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
  try {
    const {data,error}=await (await createClient()).rpc('respond_omok_friend_invite',{
      p_invite_id:id,p_accept:accept,
    });
    if(error){const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
