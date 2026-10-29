import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/user',()=>({getVerifiedUser:mock.getUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:mock.client}));
import {GET as search} from '../src/app/api/players/search/route';
import {GET as detail} from '../src/app/api/players/[id]/route';
import {GET as me} from '../src/app/api/players/me/route';
import {PUT as settings} from '../src/app/api/players/me/settings/route';
const a='00000000-0000-0000-0000-000000000011',b='11111111-1111-1111-1111-111111111112',host='https://alkkagi-alpha.vercel.app';
function request(path:string,method='GET',body?:unknown,origin=host){return new NextRequest(host+path,{
 method,headers:method==='PUT'?{'content-type':'application/json',origin}:{},
 body:method==='PUT'?JSON.stringify(body):undefined,
});}
beforeEach(()=>{vi.resetAllMocks();mock.getUser.mockResolvedValue({id:a});
 mock.client.mockResolvedValue({rpc:mock.rpc});mock.rpc.mockResolvedValue({data:[],error:null});});
describe('authenticated public-player HTTP contracts',()=>{
 it('rejects anonymous users on every endpoint',async()=>{
  mock.getUser.mockResolvedValue(null);
  expect((await search(request('/api/players/search?q=Al'))).status).toBe(401);
  expect((await detail(request('/api/players/'+b),{params:Promise.resolve({id:b})})).status).toBe(401);
  expect((await me()).status).toBe(401);
  expect((await settings(request('/api/players/me/settings','PUT',{discoverable:true,showRankedStats:true}))).status).toBe(401);
 });
 it('validates literal search terms and disables shared caches',async()=>{
  const out=await search(request('/api/players/search?q=Al&limit=5'));
  expect(out.status).toBe(200);expect(out.headers.get('cache-control')).toContain('no-store');
  expect(out.headers.get('vary')).toBe('Cookie');
  expect(mock.rpc).toHaveBeenCalledWith('search_player_profiles',{p_query:'Al',p_limit:5});
  for(const path of ['/api/players/search','/api/players/search?q=a','/api/players/search?q=%25','/api/players/search?q=Al&limit=999'])
   expect((await search(request(path))).status).toBe(400);
 });
 it('returns a 404 for hidden or unknown players, never leaks errors',async()=>{
  expect((await detail(request('/api/players/nope'),{params:Promise.resolve({id:'nope'})})).status).toBe(400);
  mock.rpc.mockResolvedValue({data:null,error:null});
  expect((await detail(request('/api/players/'+b),{params:Promise.resolve({id:b})})).status).toBe(404);
  mock.rpc.mockResolvedValue({data:null,error:{message:'secret database error'}});
  const res=await search(request('/api/players/search?q=Al'));
  expect(res.status).toBe(503);expect(JSON.stringify(await res.json())).not.toContain('secret');
 });
 it('reads own public profile and visibility settings',async()=>{
  mock.rpc.mockImplementation(async(name:string)=>({data:name==='get_public_player_profile'?
   {id:a,nickname:'오리온',ranked:{rating:1000},isSelf:true}:
   {discoverable:true,showRankedStats:false},error:null}));
  const res=await me();expect(res.status).toBe(200);
  expect((await res.json()).data.settings).toEqual({discoverable:true,showRankedStats:false});
 });
 it('requires strict same-origin boolean mutation',async()=>{
  const url='/api/players/me/settings',data={discoverable:false,showRankedStats:false};
  expect((await settings(request(url,'PUT',data,'https://evil.invalid'))).status).toBe(403);
  expect((await settings(request(url,'PUT',{...data,user_id:b}))).status).toBe(400);
  expect((await settings(request(url,'PUT',{...data,showRankedStats:1}))).status).toBe(400);
  mock.rpc.mockResolvedValue({data,error:null});
  const res=await settings(request(url,'PUT',data));expect(res.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('set_my_player_profile_settings',{p_discoverable:false,p_show_ranked_stats:false});
 });
});
