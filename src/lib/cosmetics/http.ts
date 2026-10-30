import 'server-only';
import {friendData,friendError} from '@/lib/friends/http';
export {friendData,friendError};
export function cosmeticDbError(message?:string){
  const safe:Record<string,number>={
    AUTH_REQUIRED:401,
    INVALID_COSMETIC_ITEM:400,
    INVALID_PLAYER_ID:400,
    PROFILE_NOT_FOUND:404,
    COSMETIC_NOT_AVAILABLE:404,
    COSMETIC_LOCKED:409,
  };
  if(message&&Object.hasOwn(safe,message))return friendError(message,safe[message]);
  return friendError('COSMETIC_SERVICE_UNAVAILABLE',503);
}
