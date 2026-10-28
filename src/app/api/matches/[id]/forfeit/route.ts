import {NextResponse,type NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';

export const runtime='nodejs';
export async function POST(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'INVALID_MATCH'},{status:400});
 const {data}=await (await createClient()).from('matches').select('id,status').eq('id',id).maybeSingle();
 if(!data)return NextResponse.json({error:'MATCH_NOT_FOUND'},{status:404});
 if(data.status!=='active')return NextResponse.json({error:'MATCH_FINISHED'},{status:409});
 try{
  const {error}=await createAdminClient().rpc('forfeit_casual_match',{p_match_id:id,p_actor:user.id});
  if(error)return NextResponse.json({error:'MATCH_CONFLICT'},{status:409});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'SERVER_UNAVAILABLE'},{status:503});}
}
