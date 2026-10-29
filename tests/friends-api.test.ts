import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/user',()=>({getVerifiedUser:mock.getUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:mock.client}));

import {GET as getFriends} from '../src/app/api/friends/route';
import {POST as sendRequest} from '../src/app/api/friends/requests/route';
import {POST as respondRequest} from '../src/app/api/friends/requests/[id]/respond/route';
import {DELETE as removeFriend} from '../src/app/api/friends/[id]/route';
import {PUT as setBlock} from '../src/app/api/friends/blocks/[id]/route';
import {isFriendBlockInput,isFriendRespondInput,isFriendTargetInput}
 from '../src/lib/friends/validation';

const origin='https://alkkagi-alpha.vercel.app';
const a='00000000-0000-0000-0000-000000000011';
const b='11111111-1111-1111-1111-111111111112';
const reqId='22222222-2222-2222-2222-222222222223';
const params=(id:string)=>({params:Promise.resolve({id})});
function req(path:string,method='GET',body?:unknown,from=origin,options?:{headers?:Record<string,string>}){
 const headers:Record<string,string>={...options?.headers};
 if(method==='POST'||method==='PUT'){
  headers['content-type']='application/json';
  headers.origin=from;
 } else if(method==='DELETE'){headers.origin=from;}
 return new NextRequest(origin+path,{method,headers,
  body:method==='POST'||method==='PUT'?JSON.stringify(body):undefined,
 });
}
beforeEach(()=>{
 vi.resetAllMocks();
 mock.getUser.mockResolvedValue({id:a});
 mock.client.mockResolvedValue({rpc:mock.rpc});
 mock.rpc.mockResolvedValue({data:{status:'pending'},error:null});
});

describe('Friends V1 HTTP contract',()=>{
 it('accepts only exact expected input keys and valid UUIDs',()=>{
  expect(isFriendTargetInput({targetId:b})).toBe(true);
  expect(isFriendTargetInput({targetId:b,actorId:a})).toBe(false);
  expect(isFriendTargetInput({targetId:'fake'})).toBe(false);
  expect(isFriendRespondInput({accept:false})).toBe(true);
  expect(isFriendRespondInput({accept:1})).toBe(false);
  expect(isFriendBlockInput({blocked:true})).toBe(true);
  expect(isFriendBlockInput({blocked:false,userId:a})).toBe(false);
 });
 it('denies all unauthenticated read and mutation endpoints',async()=>{
  mock.getUser.mockResolvedValue(null);
  expect((await getFriends()).status).toBe(401);
  expect((await sendRequest(req('/api/friends/requests','POST',{targetId:b}))).status).toBe(401);
  expect((await respondRequest(req('/api/friends/requests/'+reqId+'/respond','POST',{accept:true}),params(reqId))).status).toBe(401);
  expect((await removeFriend(req('/api/friends/'+b,'DELETE'),params(b))).status).toBe(401);
  expect((await setBlock(req('/api/friends/blocks/'+b,'PUT',{blocked:true}),params(b))).status).toBe(401);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('returns private no-store overview, and propagates only safe data',async()=>{
  const obj={friends:[],incoming:[],outgoing:[],blocked:[]};
  mock.rpc.mockResolvedValue({data:obj,error:null});
  const res=await getFriends();
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(res.headers.get('vary')).toBe('Cookie');
  expect((await res.json()).data).toEqual(obj);
  expect(mock.rpc).toHaveBeenCalledWith('get_friend_overview');
 });
 it('validates CSRF and body before executing SQL',async()=>{
  expect((await sendRequest(req('/api/friends/requests','POST',{targetId:b},'https://evil.example'))).status).toBe(403);
  expect((await sendRequest(req('/api/friends/requests','POST',{targetId:'bad'}))).status).toBe(400);
  expect((await sendRequest(req('/api/friends/requests','POST',{targetId:b,actorId:a}))).status).toBe(400);
  expect((await respondRequest(req('/api/friends/requests/'+reqId+'/respond','POST',{accept:'yes'}),params(reqId))).status).toBe(400);
  expect((await setBlock(req('/api/friends/blocks/'+b,'PUT',{blocked:'yes'}),params(b))).status).toBe(400);
  expect((await removeFriend(req('/api/friends/'+b,'DELETE',undefined,'https://evil.example'),params(b))).status).toBe(403);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('rejects oversize payloads even with chunked requests',async()=>{
  const request=req('/api/friends/requests','POST',{targetId:b,junk:'x'.repeat(3000)});
  const res=await sendRequest(request);
  expect(res.status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('calls RPCs using only validated input; never takes an actorId',async()=>{
  const send=await sendRequest(req('/api/friends/requests','POST',{targetId:b}));
  expect(send.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('send_friend_request',{p_target:b});
  mock.rpc.mockResolvedValue({data:{requestId:reqId,status:'accepted'},error:null});
  expect((await respondRequest(req('/api/friends/requests/'+reqId+'/respond','POST',{accept:true}),params(reqId))).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('respond_friend_request',{p_request_id:reqId,p_accept:true});
  mock.rpc.mockResolvedValue({data:{blocked:true,userId:b},error:null});
  expect((await setBlock(req('/api/friends/blocks/'+b,'PUT',{blocked:true}),params(b))).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('set_player_block',{p_target:b,p_block:true});
  mock.rpc.mockResolvedValue({data:false,error:null});
  const deleted=await removeFriend(req('/api/friends/'+b,'DELETE'),params(b));
  expect((await deleted.json()).data.removed).toBe(false);
  expect(mock.rpc).toHaveBeenCalledWith('remove_friend',{p_target:b});
 });
 it('does not disclose backend errors; maps approved domain codes',async()=>{
  mock.rpc.mockResolvedValue({data:null,error:{message:'FRIEND_REQUEST_COOLDOWN'}});
  const res=await sendRequest(req('/api/friends/requests','POST',{targetId:b}));
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('FRIEND_REQUEST_COOLDOWN');
  mock.rpc.mockResolvedValue({data:null,error:{message:'role password or SQL secret text'}});
  const failed=await sendRequest(req('/api/friends/requests','POST',{targetId:b}));
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain('secret');
 });
});
