import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { omokRpcError } from '@/lib/omok/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET() {
  if(!await getVerifiedUser())return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  try {
    const {data,error}=await (await createClient()).rpc('omok_ranked_dashboard');
    if(error){const failure=omokRpcError(error);return NextResponse.json({error:failure.error},{status:failure.status});}
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'GAME_SERVICE_UNAVAILABLE'},{status:503});}
}
