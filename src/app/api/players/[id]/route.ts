import {NextRequest,NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {PLAYER_UUID} from '@/lib/players/validation';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401,headers});
 const {id}=await params;
 if(!PLAYER_UUID.test(id))
  return NextResponse.json({error:'INVALID_PLAYER_ID'},{status:400,headers});
 try{
  const {data,error}=await (await createClient()).rpc('get_public_player_profile',{
   p_player_id:id,
  });
  if(error)return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
  if(!data)return NextResponse.json({error:'PLAYER_NOT_FOUND'},{status:404,headers});
  return NextResponse.json({data},{headers});
 }catch{
  return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
 }
}
