import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/user',()=>({getVerifiedUser:mock.getUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:mock.client}));
import {GET as inbox} from '../src/app/api/messages/route';
import {GET as history,POST as send} from '../src/app/api/messages/[peerId]/route';
import {PUT as read} from '../src/app/api/messages/[peerId]/read/route';
import {isMessageBody,isMessageId,isReadReceipt,isSendMessage,parseMessagePage}
  from '../src/lib/messages/validation';

const origin='https://alkkagi-alpha.vercel.app';
const peer='11111111-1111-4111-8111-111111111112';
const reqid='77777777-7777-4777-8777-777777777777';
const params=(peerId:string)=>({params:Promise.resolve({peerId})});
function request(path:string,method='GET',body?:unknown,from=origin){
  return new NextRequest(origin+path,{
    method,headers:method==='GET'?{}:{'content-type':'application/json','origin':from},
    body:method==='POST'||method==='PUT'?JSON.stringify(body):undefined,
  });
}
beforeEach(()=>{
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({id:'00000000-0000-4000-8000-000000000011'});
  mock.client.mockResolvedValue({rpc:mock.rpc});
  mock.rpc.mockResolvedValue({data:[],error:null});
});
describe('Direct messages HTTP authentication and input contract',()=>{
  it('validates strict JSON and safe message cursor',()=>{
    expect(isMessageBody('hello')).toBe(true);
    expect(isMessageBody(' ')).toBe(false);
    expect(isMessageBody('x'.repeat(501))).toBe(false);
    expect(isMessageBody('hi\u0000there')).toBe(false);
    expect(isSendMessage({body:'hello',requestId:reqid})).toBe(true);
    expect(isSendMessage({body:'hello',requestId:reqid,senderId:peer})).toBe(false);
    expect(isReadReceipt({messageId:'123'})).toBe(true);
    expect(isReadReceipt({messageId:'123',userId:peer})).toBe(false);
    expect(isMessageId('01')).toBe(false);
    expect(isMessageId('9007199254740992')).toBe(false);
    expect(parseMessagePage(new URL(origin+'/api/messages/'+peer+'?before=11&limit=50')))
      .toEqual({beforeId:'11',limit:50});
    expect(parseMessagePage(new URL(origin+'/api/messages/'+peer+'?limit=51'))).toBe(null);
    expect(parseMessagePage(new URL(origin+'/api/messages/'+peer+'?limit=1&limit=1'))).toBe(null);
    expect(parseMessagePage(new URL(origin+'/api/messages/'+peer+'?other=1'))).toBe(null);
  });
  it('requires authentication for every endpoint',async()=>{
    mock.getUser.mockResolvedValue(null);
    expect((await inbox()).status).toBe(401);
    expect((await history(request('/api/messages/'+peer),params(peer))).status).toBe(401);
    expect((await send(request('/api/messages/'+peer,'POST',{body:'hi',requestId:reqid}),params(peer))).status).toBe(401);
    expect((await read(request('/api/messages/'+peer+'/read','PUT',{messageId:'1'}),params(peer))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('reads private no-store inbox and page with bounded cursor',async()=>{
    mock.rpc.mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({
      data:{threadId:null,messages:[],hasMore:false},error:null,
    });
    const res=await inbox();expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('vary')).toBe('Cookie');
    const hist=await history(request('/api/messages/'+peer+'?before=15&limit=20'),params(peer));
    expect(hist.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('get_direct_messages',{
      p_peer:peer,p_before_id:'15',p_limit:20,
    });
  });
  it('rejects cross-origin, malformed and overlong POST bodies before RPC',async()=>{
    const url='/api/messages/'+peer;
    expect((await send(request(url,'POST',{body:'hi',requestId:reqid},'https://attacker.invalid'),params(peer))).status).toBe(403);
    expect((await send(request(url,'POST',{body:'hi',requestId:'bad'}),params(peer))).status).toBe(400);
    expect((await send(request(url,'POST',{body:'x'.repeat(5000),requestId:reqid}),params(peer))).status).toBe(400);
    expect((await send(request(url,'POST',{body:'hi',requestId:reqid,senderId:peer}),params(peer))).status).toBe(400);
    expect((await send(request('/api/messages/bad','POST',{body:'hi',requestId:reqid}),params('bad'))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('validates reading cursors and requires same origin for PUT',async()=>{
    const url='/api/messages/'+peer+'/read';
    expect((await read(request(url,'PUT',{messageId:'15'},'https://attacker.invalid'),params(peer))).status).toBe(403);
    expect((await read(request(url,'PUT',{messageId:'001'}),params(peer))).status).toBe(400);
    expect((await read(request(url,'PUT',{messageId:'15',userId:peer}),params(peer))).status).toBe(400);
    expect((await history(request('/api/messages/'+peer+'?before=-1'),params(peer))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('passes validated parameters to RPC without spoofable senderId',async()=>{
    mock.rpc.mockResolvedValueOnce({
      data:{id:'15',threadId:peer,body:'hi',alreadySent:false},error:null,
    }).mockResolvedValueOnce({
      data:{lastReadId:'15',threadId:peer},error:null,
    });
    expect((await send(request('/api/messages/'+peer,'POST',{body:'hi',requestId:reqid}),params(peer))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('send_direct_message',{
      p_peer:peer,p_body:'hi',p_request_id:reqid,
    });
    expect((await read(request('/api/messages/'+peer+'/read','PUT',{messageId:'15'}),params(peer))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('mark_direct_messages_read',{p_peer:peer,p_message_id:'15'});
  });
  it('masks backend errors and maps only allowlisted domain errors',async()=>{
    mock.rpc.mockResolvedValue({data:null,error:{message:'DM_RATE_LIMIT'}});
    const blocked=await send(request('/api/messages/'+peer,'POST',{body:'hi',requestId:reqid}),params(peer));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('DM_RATE_LIMIT');
    mock.rpc.mockResolvedValue({data:null,error:{message:'SQL secret information'}});
    const fail=await send(request('/api/messages/'+peer,'POST',{body:'hi',requestId:reqid}),params(peer));
    expect(fail.status).toBe(503);
    expect(JSON.stringify(await fail.json())).not.toContain('secret');
  });
});