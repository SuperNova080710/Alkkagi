import {NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {friendData,friendDbFailure,friendError} from '@/lib/friends/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  if(!await getVerifiedUser())return friendError('AUTH_REQUIRED',401);
  try{
    const {data,error}=await (await createClient()).rpc('get_friend_overview');
    if(error||!data)return friendDbFailure(error?.message);
    return friendData(data);
  }catch{return friendDbFailure();}
}
