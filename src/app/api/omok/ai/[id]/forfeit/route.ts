import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOmokUuid, omokRpcError } from '@/lib/omok/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const user=await getVerifiedUser();
  if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  const {id}=await params;
  if(!isOmokUuid(id))return NextResponse.json({error:'INVALID_MATCH'},{status:400});
  try {
    const {data,error}=await createAdminClient().rpc('forfeit_omok_ai_match',
      {p_match_id:id,p_actor:user.id});
    if(error){const failure=omokRpcError(error);
      return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
