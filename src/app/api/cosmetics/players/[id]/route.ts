import {NextRequest} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {PLAYER_UUID} from '@/lib/players/validation';
import {friendData,friendError,cosmeticDbError} from '@/lib/cosmetics/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!await getVerifiedUser())return friendError('AUTH_REQUIRED',401);
  const {id}=await params;
  if(!PLAYER_UUID.test(id))return friendError('INVALID_PLAYER_ID',400);
  try{
    const {data,error}=await (await createClient()).rpc('get_public_player_cosmetics',{
      p_player_id:id,
    });
    if(error)return cosmeticDbError(error.message);
    if(!data)return friendError('PLAYER_NOT_FOUND',404);
    if(typeof data.pieceCode!=='string'||typeof data.avatarCode!=='string')
      return cosmeticDbError();
    return friendData(data);
  }catch{return cosmeticDbError();}
}
