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
  const db=await createClient();
  const [profile,settings]=await Promise.all([
   db.rpc('get_public_player_profile',{p_player_id:user.id}),
   db.rpc('get_my_player_profile_settings'),
  ]);
  if(profile.error||settings.error||!profile.data||!settings.data)
   return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
  return NextResponse.json({data:{profile:profile.data,settings:settings.data}},{headers});
 }catch{
  return NextResponse.json({error:'PROFILE_SERVICE_UNAVAILABLE'},{status:503,headers});
 }
}
