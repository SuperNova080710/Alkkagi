import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/user',()=>({getVerifiedUser:mock.getUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:mock.client}));

import {GET as received,POST as send}
  from '../src/app/api/room-invites/route';
import {GET as sent} from '../src/app/api/room-invites/sent/route';
import {POST as respond}
  from '../src/app/api/room-invites/[inviteId]/respond/route';
import {isInviteResponse,isSendInvite} from '../src/lib/room-invites/validation';

const origin='https://alkkagi-alpha.vercel.app';
const room='11111111-1111-4111-8111-111111111111';
const target='22222222-2222-4222-8222-222222222222';
const invite='33333333-3333-4333-8333-333333333333';
const params=(inviteId:string)=>({params:Promise.resolve({inviteId})});
const req=(path:string,method='GET',body?:unknown,from=origin)=>new NextRequest(origin+path,{
 method,
 headers:method==='GET'?{}:{'content-type':'application/json','origin':from},
 body:method==='POST'?JSON.stringify(body):undefined,
});
beforeEach(()=>{
 vi.resetAllMocks();
 mock.getUser.mockResolvedValue({id:room});
 mock.client.mockResolvedValue({rpc:mock.rpc});
 mock.rpc.mockResolvedValue({data:[],error:null});
});
describe('Room invite V1 HTTP contract',()=>{
 it('validates exact UUID/body schema and boolean',()=>{
  expect(isSendInvite({roomId:room,targetId:target})).toBe(true);
  expect(isSendInvite({roomId:room,targetId:target,inviterId:room})).toBe(false);
  expect(isSendInvite({roomId:'bad',targetId:target})).toBe(false);
  expect(isInviteResponse({accept:false})).toBe(true);
  expect(isInviteResponse({accept:1})).toBe(false);
  expect(isInviteResponse({accept:true,roomId:room})).toBe(false);
 });
 it('blocks anonymous users before querying RPCs',async()=>{
  mock.getUser.mockResolvedValue(null);
  expect((await received()).status).toBe(401);
  expect((await sent(req('/api/room-invites/sent?roomId='+room))).status).toBe(401);
  expect((await send(req('/api/room-invites','POST',{roomId:room,targetId:target}))).status).toBe(401);
  expect((await respond(req('/api/room-invites/'+invite+'/respond','POST',{accept:true}),params(invite))).status).toBe(401);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('returns private no-store received and host sent lists',async()=>{
  const rec=[{id:invite,roomId:room,inviterId:target,inviterNickname:'Friend'}];
  mock.rpc.mockResolvedValueOnce({data:rec,error:null})
    .mockResolvedValueOnce({data:[],error:null});
  const r=await received();
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toContain('no-store');
  expect(r.headers.get('vary')).toBe('Cookie');
  expect((await r.json()).data).toEqual(rec);
  const s=await sent(req('/api/room-invites/sent?roomId='+room));
  expect(s.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('list_sent_room_invites',{p_room_id:room});
 });
 it('rejects malformed query params, disallows cross-origin POST and invalid bodies',async()=>{
  for(const query of ['', '?roomId=bad', '?roomId='+room+'&roomId='+room,'?roomId='+room+'&ownerId='+target]){
    expect((await sent(req('/api/room-invites/sent'+query))).status).toBe(400);
  }
  expect((await send(req('/api/room-invites','POST',{roomId:room,targetId:target},'https://attacker.invalid'))).status).toBe(403);
  expect((await send(req('/api/room-invites','POST',{roomId:room,targetId:target,role:'admin'}))).status).toBe(400);
  expect((await send(req('/api/room-invites','POST',{roomId:room,targetId:'invalid'}))).status).toBe(400);
  expect((await send(req('/api/room-invites','POST',{roomId:room,targetId:target,stuff:'x'.repeat(4000)}))).status).toBe(400);
  expect((await respond(req('/api/room-invites/'+invite+'/respond','POST',{accept:1}),params(invite))).status).toBe(400);
  expect((await respond(req('/api/room-invites/'+invite+'/respond','POST',{accept:true},'https://attacker.invalid'),params(invite))).status).toBe(403);
  expect((await respond(req('/api/room-invites/bad/respond','POST',{accept:true}),params('bad'))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('calls atomic invitation RPCs with only validated input',async()=>{
  mock.rpc.mockResolvedValueOnce({data:{inviteId:invite,status:'pending',alreadyPending:false},error:null})
    .mockResolvedValueOnce({data:{inviteId:invite,status:'accepted',roomId:room},error:null});
  const s=await send(req('/api/room-invites','POST',{roomId:room,targetId:target}));
  expect(s.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('send_room_friend_invite',{p_room_id:room,p_target_id:target});
  const a=await respond(req('/api/room-invites/'+invite+'/respond','POST',{accept:true}),params(invite));
  expect(a.status).toBe(200);
  expect((await a.json()).data.roomId).toBe(room);
  expect(mock.rpc).toHaveBeenCalledWith('respond_room_friend_invite',{p_invite_id:invite,p_accept:true});
 });
 it('maps explicit domain errors and conceals all unknown SQL information',async()=>{
  mock.rpc.mockResolvedValue({data:null,error:{message:'ROOM_INVITE_RATE_LIMIT'}});
  const busy=await send(req('/api/room-invites','POST',{roomId:room,targetId:target}));
  expect(busy.status).toBe(429);
  expect((await busy.json()).error).toBe('ROOM_INVITE_RATE_LIMIT');
  mock.rpc.mockResolvedValue({data:null,error:{message:'private database credential secret'}});
  const error=await send(req('/api/room-invites','POST',{roomId:room,targetId:target}));
  expect(error.status).toBe(503);
  expect(JSON.stringify(await error.json())).not.toContain('secret');
 });
});
