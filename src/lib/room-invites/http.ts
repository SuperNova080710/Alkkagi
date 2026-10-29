import 'server-only';
import {friendData,friendError} from '@/lib/friends/http';

export {friendData,friendError};
export function inviteDbError(message?:string){
  const codes:Record<string,number>={
    AUTH_REQUIRED:401,INVALID_ROOM_INVITE:400,
    ROOM_NOT_AVAILABLE:404,ROOM_INVITE_NOT_FOUND:404,FRIEND_NOT_AVAILABLE:404,
    ROOM_INVITE_ALREADY_SENT:409,ROOM_INVITE_RATE_LIMIT:429,
    ROOM_INVITE_INBOX_FULL:429,
  };
  if(message&&Object.hasOwn(codes,message)){
    return friendError(message,codes[message]);
  }
  return friendError('ROOM_INVITE_SERVICE_UNAVAILABLE',503);
}
