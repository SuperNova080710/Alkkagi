import {NextRequest} from 'next/server';
import {friendMutation} from '@/lib/friends/http';
import {createClient} from '@/lib/supabase/server';
import {friendData,friendError,cosmeticDbError} from '@/lib/cosmetics/http';
import {validEquipCosmetic} from '@/lib/cosmetics/validation';
export const runtime='nodejs';

export async function PUT(request:NextRequest){
  const parsed=await friendMutation(request);
  if(!parsed.ok)return parsed.response;
  if(!validEquipCosmetic(parsed.body))return friendError('INVALID_COSMETIC_ITEM',400);
  try{
    const {data,error}=await (await createClient()).rpc('equip_my_cosmetic',{
      p_item_code:parsed.body.itemCode,
    });
    if(error||!data||typeof data.pieceCode!=='string'||typeof data.avatarCode!=='string')
      return cosmeticDbError(error?.message);
    return friendData(data);
  }catch{return cosmeticDbError();}
}
