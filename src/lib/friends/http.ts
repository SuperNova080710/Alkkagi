import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {getVerifiedUser} from '@/lib/auth/user';

export const FRIEND_HEADERS={'Cache-Control':'private, no-store','Vary':'Cookie'};
export function friendError(error:string,status:number){
  return NextResponse.json({error},{status,headers:FRIEND_HEADERS});
}
export function friendData(data:unknown){
  return NextResponse.json({data},{headers:FRIEND_HEADERS});
}

export function friendDbFailure(message?:string){
  const known:Record<string,number>={
    AUTH_REQUIRED:401,
    INVALID_FRIEND_TARGET:400,INVALID_FRIEND_REQUEST:400,INVALID_BLOCK_TARGET:400,
    FRIEND_NOT_AVAILABLE:404,FRIEND_REQUEST_NOT_FOUND:404,
    ALREADY_FRIENDS:409,INCOMING_FRIEND_REQUEST:409,FRIEND_REQUEST_COOLDOWN:409,
    FRIEND_REQUEST_LIMIT:429,FRIEND_INBOX_FULL:429,FRIENDS_FULL:409,
  };
  for(const [code,status] of Object.entries(known)){
    if(message===code)return friendError(code,status);
  }
  return friendError('FRIEND_SERVICE_UNAVAILABLE',503);
}
export async function friendDeletion(request:NextRequest):Promise<NextResponse|null>{
  if(!await getVerifiedUser())return friendError('AUTH_REQUIRED',401);
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return friendError('ORIGIN_NOT_ALLOWED',403);
  return null;
}
export async function friendMutation(request:NextRequest):Promise<
  {ok:true;body:unknown}|{ok:false;response:NextResponse}
>{
  if(!await getVerifiedUser())return {ok:false,response:friendError('AUTH_REQUIRED',401)};
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return {ok:false,response:friendError('ORIGIN_NOT_ALLOWED',403)};
  if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')??''))
    return {ok:false,response:friendError('INVALID_REQUEST',400)};
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))
    return {ok:false,response:friendError('INVALID_REQUEST',400)};

  // Bounded incremental read, including chunked/missing Content-Length bodies.
  const reader=request.body?.getReader();
  if(!reader)return {ok:false,response:friendError('INVALID_REQUEST',400)};
  const decoder=new TextDecoder();
  let raw='',bytes=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>2048){
        await reader.cancel();
        return {ok:false,response:friendError('INVALID_REQUEST',400)};
      }
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    return {ok:true,body:JSON.parse(raw) as unknown};
  }catch{
    return {ok:false,response:friendError('INVALID_REQUEST',400)};
  }
}
