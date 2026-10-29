import {NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};

export async function GET(){
  const user=await getVerifiedUser();
  if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401,headers});
  try{
    const {data,error}=await (await createClient()).rpc('get_player_experience',{
      p_player_id:user.id,
    });
    if(error||!data)return NextResponse.json({error:'XP_SERVICE_UNAVAILABLE'},{status:503,headers});
    return NextResponse.json({data},{headers});
  }catch{return NextResponse.json({error:'XP_SERVICE_UNAVAILABLE'},{status:503,headers});}
}
