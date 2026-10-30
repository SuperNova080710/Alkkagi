import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {friendData,friendError,cosmeticDbError} from '@/lib/cosmetics/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  if(!await getVerifiedUser())return friendError('AUTH_REQUIRED',401);
  try{
    const {data,error}=await (await createClient()).rpc('get_my_cosmetics');
    if(error||!data||!Array.isArray(data.items)||!data.loadout)
      return cosmeticDbError(error?.message);
    return friendData(data);
  }catch{return cosmeticDbError();}
}
