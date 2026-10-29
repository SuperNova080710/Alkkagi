import {isFriendId} from '@/lib/friends/validation';

export {isFriendId};
const exact=(x:unknown,fields:string[]):x is Record<string,unknown> =>
  x!==null&&typeof x==='object'&&!Array.isArray(x)
  &&Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
export const isMessageId=(x:unknown):x is string=>
  typeof x==='string'&&/^[1-9][0-9]{0,14}$/.test(x)&&Number.isSafeInteger(Number(x));
export const isMessageBody=(x:unknown):x is string=>
  typeof x==='string'&&x.trim().length>=1&&x.trim().length<=500
    &&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
export const isSendMessage=(x:unknown):x is {body:string;requestId:string}=>
  exact(x,['body','requestId'])&&isMessageBody(x.body)&&isFriendId(x.requestId);
export const isReadReceipt=(x:unknown):x is {messageId:string}=>
  exact(x,['messageId'])&&isMessageId(x.messageId);
export function parseMessagePage(url:URL){
  const keys=[...url.searchParams.keys()];
  if(keys.some(k=>k!=='limit'&&k!=='before')||keys.length!==new Set(keys).size)return null;
  const before=url.searchParams.get('before');
  const limit=url.searchParams.get('limit');
  if(before!==null&&!isMessageId(before))return null;
  if(limit!==null&&(!/^[1-9][0-9]{0,1}$/.test(limit)||Number(limit)>50))return null;
  return {beforeId:before,limit:limit===null?30:Number(limit)};
}
