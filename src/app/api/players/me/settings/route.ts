import {NextRequest,NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {playerVisibilitySettings} from '@/lib/players/validation';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};

export async function PUT(request:NextRequest){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401,headers});
 // Cookie-authenticated mutation: require a browser same-origin request.
 const origin=request.headers.get('origin');
 if(!origin||origin!==request.nextUrl.origin)
  return NextResponse.json({error:'ORIGIN_NOT_ALLOWED'},{status:403,headers});
 if(!request.headers.get('content-type')?.startsWith('application/json'))
  return NextResponse.json({error:'INVALID_REQUEST'},{status:400,headers});
 const contentLength=Number(request.headers.get('content-length')??0);
 if(!Number.isFinite(contentLength)||contentLength>2048)
  return NextResponse.json({error:'INVALID_REQUEST'},{status:400,headers});
 let input:unknown;
 try{input=await request.json();}catch{
  return NextResponse.json({error:'INVALID_REQUEST'},{status:400,headers});
 }
 if(!playerVisibilitySettings(input))
  return NextResponse.json({error:'INVALID_SETTINGS'},{status:400,headers});
 try{
  const {data,error}=await (await createClient()).rpc('set_my_player_profile_settings',{
   p_discoverable:input.discoverable,
   p_show_ranked_stats:input.showRankedStats,
  });
  if(error||!data)
   return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
  return NextResponse.json({data},{headers});
 }catch{
  return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
 }
}
