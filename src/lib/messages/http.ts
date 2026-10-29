import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';

const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export const messageData=(data:unknown)=>NextResponse.json({data},{headers});
export const messageError=(error:string,status:number)=>
  NextResponse.json({error},{status,headers});
export function messageRpcError(message?:string){
  const known:Record<string,number>={
    AUTH_REQUIRED:401,DM_NOT_AVAILABLE:404,
    DM_INVALID_MESSAGE:400,DM_INVALID_PAGE:400,DM_INVALID_MESSAGE_ID:400,
    DM_RATE_LIMIT:429,DM_DAILY_LIMIT:429,DM_THREAD_FULL:409,
  };
  const status=message&&Object.hasOwn(known,message)?known[message]:503;
  return messageError(status===503?'DM_SERVICE_UNAVAILABLE':message!,status);
}
export async function mutation(request:NextRequest):Promise<
  {ok:true;body:unknown}|{ok:false;response:NextResponse}
>{
  if(!await getVerifiedUser())return {ok:false,response:messageError('AUTH_REQUIRED',401)};
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return {ok:false,response:messageError('ORIGIN_NOT_ALLOWED',403)};
  if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')??''))
    return {ok:false,response:messageError('INVALID_REQUEST',400)};
  const advertised=request.headers.get('content-length');
  if(advertised!==null&&(!/^\d+$/.test(advertised)||Number(advertised)>4096))
    return {ok:false,response:messageError('INVALID_REQUEST',400)};
  const reader=request.body?.getReader();
  if(!reader)return {ok:false,response:messageError('INVALID_REQUEST',400)};
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let raw='',bytes=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>4096){
        await reader.cancel();
        return {ok:false,response:messageError('INVALID_REQUEST',400)};
      }
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    return {ok:true,body:JSON.parse(raw) as unknown};
  }catch{
    return {ok:false,response:messageError('INVALID_REQUEST',400)};
  }
}
