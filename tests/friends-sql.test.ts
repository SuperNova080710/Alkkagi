import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,describe,expect,it} from 'vitest';

const a='00000000-0000-0000-0000-000000000011';
const b='11111111-1111-1111-1111-111111111112';
const c='22222222-2222-2222-2222-222222222223';
const d='33333333-3333-3333-3333-333333333334';
let db:PGlite;
async function as(id:string){
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function rpc<T=unknown>(name:string,args:unknown[]=[]){
 const params=args.map((_,i)=>'$'+(i+1)).join(',');
 return (await db.query<Record<string,T>>('select public.'+name+'('+params+') as result',args)).rows[0].result;
}
async function overview(){
 return rpc<{friends:{id:string;nickname:string}[];incoming:{id:string;userId:string}[];
  outgoing:{id:string;userId:string}[];blocked:{id:string}[]}>('get_friend_overview');
}
describe('Friends V1: relationship and block SQL boundary',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"'),('"+d+"')");
  for(const f of ['202610280001_initial_schema.sql','202610280006_ranked_queue_and_rating.sql',
   '202610280010_profile_nickname.sql','202610290003_player_profile_discovery.sql',
   '202610290005_friends_v1.sql'])
   await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  for(const [id,nick] of [[a,'Alpha'],[b,'Bravo'],[c,'Charlie'],[d,'Delta']]){
   await as(id);await rpc('set_my_nickname',[nick]);
  }
 },30000);
 beforeEach(async()=>{
  await db.exec('reset role; truncate public.friend_links,public.player_blocks,public.player_profile_settings;');
 },30000);
 afterAll(async()=>{await db?.close();});
 it('hides unauthorized records and denies client writes or anonymous RPCs',async()=>{
  await as(a);
  await expect(db.query("insert into public.friend_links(requester_id,recipient_id) values($1,$2)",[a,b]))
   .rejects.toThrow(/permission denied/);
  await expect(db.query("insert into public.player_blocks(blocker_id,blocked_id) values($1,$2)",[a,b]))
   .rejects.toThrow(/permission denied/);
  await rpc('send_friend_request',[b]);
  await as(c);
  expect((await db.query('select * from public.friend_links')).rows).toHaveLength(0);
  expect((await overview()).incoming).toEqual([]);
  await db.exec('reset role; set role anon;');
  for(const name of ['get_friend_overview','send_friend_request']){
   await expect(rpc(name,name==='send_friend_request'?[b]:[])).rejects.toThrow(/permission denied/);
  }
 });
 it('sends one idempotent request, blocks crossed duplicates, accepts only as recipient',async()=>{
  await as(a);
  const first=await rpc<{requestId:string;status:string;alreadyPending:boolean}>('send_friend_request',[b]);
  expect(first).toMatchObject({status:'pending',alreadyPending:false});
  expect((await rpc('send_friend_request',[b]))).toEqual({...first,alreadyPending:true});
  expect((await overview()).outgoing.map(x=>x.userId)).toEqual([b]);
  await as(c);
  await expect(rpc('respond_friend_request',[first.requestId,true]))
   .rejects.toThrow('FRIEND_REQUEST_NOT_FOUND');
  await as(b);
  expect((await overview()).incoming.map(x=>x.userId)).toEqual([a]);
  await expect(rpc('send_friend_request',[a])).rejects.toThrow('INCOMING_FRIEND_REQUEST');
  expect(await rpc('respond_friend_request',[first.requestId,true]))
   .toMatchObject({status:'accepted',requestId:first.requestId});
  expect((await overview()).friends.map(x=>x.id)).toEqual([a]);
  await as(a);
  expect((await overview()).friends.map(x=>x.id)).toEqual([b]);
  await expect(rpc('send_friend_request',[b])).rejects.toThrow('ALREADY_FRIENDS');
  expect(await rpc('remove_friend',[b])).toBe(true);
  expect(await rpc('remove_friend',[b])).toBe(false);
  await as(b);expect((await overview()).friends).toEqual([]);
 });
 it('rejects requests with cooldown and hides unavailable or private players',async()=>{
  await as(a);
  const first=await rpc<{requestId:string}>('send_friend_request',[c]);
  await as(c);
  await rpc('respond_friend_request',[first.requestId,false]);
  await as(a);
  await expect(rpc('send_friend_request',[c])).rejects.toThrow('FRIEND_REQUEST_COOLDOWN');
  await expect(rpc('send_friend_request',[a])).rejects.toThrow('INVALID_FRIEND_TARGET');
  await expect(rpc('send_friend_request',['99999999-9999-9999-9999-999999999999']))
   .rejects.toThrow('FRIEND_NOT_AVAILABLE');
  await as(b);await rpc('set_my_player_profile_settings',[false,false]);
  await as(a);
  await expect(rpc('send_friend_request',[b])).rejects.toThrow('FRIEND_NOT_AVAILABLE');
  await as(b);await rpc('set_my_player_profile_settings',[true,true]);
  await as(a);expect((await rpc<{status:string}>('send_friend_request',[b])).status).toBe('pending');
 });
 it('blocks a player in both directions, removes friendships and allows explicit unblock',async()=>{
  await as(a);
  const first=await rpc<{requestId:string}>('send_friend_request',[b]);
  await as(b);await rpc('respond_friend_request',[first.requestId,true]);
  await rpc('set_player_block',[a,true]);
  expect((await overview()).blocked.map(x=>x.id)).toEqual([a]);
  expect((await overview()).friends).toEqual([]);
  await as(a);
  await expect(rpc('send_friend_request',[b])).rejects.toThrow('FRIEND_NOT_AVAILABLE');
  expect((await overview()).friends).toEqual([]);
  await as(b);
  await expect(rpc('send_friend_request',[a])).rejects.toThrow('FRIEND_NOT_AVAILABLE');
  await expect(rpc('set_player_block',[b,true])).rejects.toThrow('INVALID_BLOCK_TARGET');
  await rpc('set_player_block',[a,false]);
  expect((await overview()).blocked).toEqual([]);
  await as(a);
  expect((await rpc<{status:string}>('send_friend_request',[b])).status).toBe('pending');
 });
 it('preserves rejection cooldown when the sender blocks and unblocks the recipient',async()=>{
  await as(a);
  const first=await rpc<{requestId:string}>('send_friend_request',[b]);
  await as(b);
  await rpc('respond_friend_request',[first.requestId,false]);
  await db.exec('reset role;');
  const rejected=(await db.query<{updated_at:string}>(
    'select updated_at::text from public.friend_links where id=$1',[first.requestId]
  )).rows[0].updated_at;

  await as(a);
  await expect(rpc('send_friend_request',[b])).rejects.toThrow('FRIEND_REQUEST_COOLDOWN');
  await rpc('set_player_block',[b,true]);
  await rpc('set_player_block',[b,false]);
  await expect(rpc('send_friend_request',[b])).rejects.toThrow('FRIEND_REQUEST_COOLDOWN');
  await db.exec('reset role;');
  const kept=(await db.query<{id:string;status:string;updated_at:string}>(
    'select id,status,updated_at::text from public.friend_links'
  )).rows;
  expect(kept).toEqual([{id:first.requestId,status:'rejected',updated_at:rejected}]);

  // Advance the rejection clock without waiting 24 real hours.
  await db.query("update public.friend_links set updated_at=clock_timestamp()-interval '25 hours' where id=$1",
    [first.requestId]);
  await as(a);
  const retried=await rpc<{requestId:string;status:string;alreadyPending:boolean}>('send_friend_request',[b]);
  expect(retried).toMatchObject({requestId:first.requestId,status:'pending',alreadyPending:false});
  expect((await overview()).outgoing.map(x=>x.userId)).toEqual([b]);
 });
 it('preserves the rejected cooldown when the recipient blocks and unblocks',async()=>{
  await as(a);
  const request=await rpc<{requestId:string}>('send_friend_request',[c]);
  await as(c);
  await rpc('respond_friend_request',[request.requestId,false]);
  await rpc('set_player_block',[a,true]);
  await rpc('set_player_block',[a,false]);
  await as(a);
  await expect(rpc('send_friend_request',[c])).rejects.toThrow('FRIEND_REQUEST_COOLDOWN');
 });
 it('does not disclose undiscoverable player nicknames through the block list',async()=>{
  await as(b);
  await rpc('set_my_player_profile_settings',[false,false]);
  await as(a);
  expect(await rpc('get_public_player_profile',[b])).toBeNull();
  await rpc('set_player_block',[b,true]);
  const hidden=await overview();
  expect(hidden.blocked).toEqual([{id:b,nickname:null}]);
  await db.exec('reset role;');
  const rows=(await db.query<{blocker_id:string;blocked_id:string}>(
    'select blocker_id,blocked_id from public.player_blocks'
  )).rows;
  expect(rows).toEqual([{blocker_id:a,blocked_id:b}]);

  // Visibility changes are honored on every overview request, not snapshotted.
  await as(b);
  await rpc('set_my_player_profile_settings',[true,true]);
  await as(a);
  expect((await overview()).blocked).toEqual([{id:b,nickname:'Bravo'}]);
  await as(b);
  await rpc('set_my_player_profile_settings',[false,false]);
  await as(a);
  expect((await overview()).blocked).toEqual([{id:b,nickname:null}]);
  await rpc('set_player_block',[b,false]);
  expect((await overview()).blocked).toEqual([]);
 });
 it('enforces outbound pending and block-list limits in database RPCs',async()=>{
  await db.exec('reset role;');
  // Seed unique existing accounts without sending email or using live auth.
  await db.exec(`
    insert into auth.users(id)
    select (lpad(to_hex(n),8,'0') || '-0000-4000-8000-000000000000')::uuid
    from generate_series(1000,1100) n;
  `);
  const targetIds=(await db.query<{id:string}>(`
    select id::text as id from auth.users
    where id not in ($1::uuid,$2::uuid,$3::uuid,$4::uuid)
    order by id limit 101
  `,[a,b,c,d])).rows.map(x=>x.id);
  for(let i=0;i<20;i++){
    await db.query('insert into public.friend_links(requester_id,recipient_id) values($1,$2)',
      [a,targetIds[i]]);
  }
  await as(a);
  await expect(rpc('send_friend_request',[d])).rejects.toThrow('FRIEND_REQUEST_LIMIT');

  await db.exec('reset role; truncate public.friend_links;');
  for(let i=0;i<100;i++){
    await db.query('insert into public.player_blocks(blocker_id,blocked_id) values($1,$2)',
      [a,targetIds[i]]);
  }
  await as(a);
  await expect(rpc('set_player_block',[d,true])).rejects.toThrow('BLOCK_LIMIT');
  expect(await rpc('set_player_block',[targetIds[0],true]))
   .toMatchObject({blocked:true,userId:targetIds[0]});
  await rpc('set_player_block',[targetIds[0],false]);
  expect(await rpc('set_player_block',[d,true])).toMatchObject({blocked:true,userId:d});
 },30000);
 it('preserves uniqueness across reversed requests and forbids any RP writes',async()=>{
  await as(a);
  await rpc('send_friend_request',[b]);
  await db.exec('reset role;');
  const keys=await db.query<{count:string}>('select count(*)::text as count from public.friend_links');
  expect(keys.rows[0].count).toBe('1');
  await expect(db.query("insert into public.friend_links(requester_id,recipient_id) values($1,$2)",[b,a]))
   .rejects.toThrow(/duplicate key/);
  await as(a);
  await expect(db.query('update public.profiles set rating=9999 where id=$1',[a]))
   .rejects.toThrow(/permission denied/);
  expect((await db.query<{rating:number}>('select rating from public.profiles where id=$1',[a])).rows[0].rating).toBe(1000);
 });
});
