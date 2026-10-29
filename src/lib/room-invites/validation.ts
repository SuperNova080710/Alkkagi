import {isFriendId,isExactObjectKey} from '@/lib/friends/validation';

export function isSendInvite(input:unknown):input is {roomId:string;targetId:string}{
  return input!==null&&typeof input==='object'&&!Array.isArray(input)
    &&Object.keys(input).length===2
    &&Object.hasOwn(input,'roomId')&&Object.hasOwn(input,'targetId')
    &&isFriendId((input as Record<string,unknown>).roomId)
    &&isFriendId((input as Record<string,unknown>).targetId);
}
export function isInviteResponse(input:unknown):input is {accept:boolean}{
  return isExactObjectKey(input,'accept')&&typeof input.accept==='boolean';
}
