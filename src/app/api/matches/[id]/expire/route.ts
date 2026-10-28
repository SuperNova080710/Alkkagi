import {NextResponse,type NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
export const runtime='nodejs';
export async function POST(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  return NextResponse.json({error:'INVALID_MATCH'},{status:400});
 // RLS confirms participant before any service-role invocation.
 const {data,error}=await (await createClient()).from('matches')
  .select('id').eq('id',id).maybeSingle();
 if(error||!data)return NextResponse.json({error:'MATCH_NOT_FOUND'},{status:404});
 try{
  const {data:outcome,error:expired}=await createAdminClient().rpc('expire_match',{p_match_id:id});
  if(expired)return NextResponse.json({error:'TIMEOUT_FAILED'},{status:409});
  return NextResponse.json({data:outcome},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'SERVER_UNAVAILABLE'},{status:503});}
}
