import {NextRequest,NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {playerSearchLimit,playerSearchQuery} from '@/lib/players/validation';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};

export async function GET(request:NextRequest){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401,headers});
 const query=playerSearchQuery(request.nextUrl.searchParams.get('q'));
 const limit=playerSearchLimit(request.nextUrl.searchParams.get('limit'));
 if(query===null||limit===null)
  return NextResponse.json({error:'INVALID_SEARCH_QUERY'},{status:400,headers});
 try{
  const {data,error}=await (await createClient()).rpc('search_player_profiles',{
   p_query:query,p_limit:limit,
  });
  if(error||!Array.isArray(data))
   return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
  return NextResponse.json({data},{headers});
 }catch{
  return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
 }
}
