import {NextResponse,type NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
export const runtime='nodejs';
export async function POST(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();
 if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'INVALID_ROOM'},{status:400});
 const {data,error}=await (await createClient()).from('ai_matches')
  .select('owner_id,status').eq('room_id',id).maybeSingle();
 if(error||!data||data.owner_id!==user.id)return NextResponse.json({error:'NOT_FOUND'},{status:404});
 if(data.status!=='active')return NextResponse.json({error:'FINISHED'},{status:409});
 const {error:forfeitError}=await createAdminClient().rpc('forfeit_ai_match',{p_room_id:id,p_actor:user.id});
 if(forfeitError)return NextResponse.json({error:'CONFLICT'},{status:409});
 return NextResponse.json({ok:true});
}
