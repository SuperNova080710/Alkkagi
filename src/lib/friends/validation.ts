import {PLAYER_UUID} from '@/lib/players/validation';

export const isFriendId=(value:unknown):value is string=>
  typeof value==='string'&&PLAYER_UUID.test(value);

export function isExactObjectKey(value:unknown,key:string):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).length===1&&Object.hasOwn(value,key);
}
export function isFriendTargetInput(value:unknown):value is {targetId:string}{
  return isExactObjectKey(value,'targetId')&&isFriendId(value.targetId);
}
export function isFriendRespondInput(value:unknown):value is {accept:boolean}{
  return isExactObjectKey(value,'accept')&&typeof value.accept==='boolean';
}
export function isFriendBlockInput(value:unknown):value is {blocked:boolean}{
  return isExactObjectKey(value,'blocked')&&typeof value.blocked==='boolean';
}
