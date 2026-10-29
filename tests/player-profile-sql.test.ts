import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';

const a='00000000-0000-0000-0000-000000000011';
const b='11111111-1111-1111-1111-111111111112';
const c='22222222-2222-2222-2222-222222222223';
let db:PGlite;
async function as(id:string){
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function profile(id:string){
 return (await db.query<{get_public_player_profile:{
  id:string;nickname:string;isSelf:boolean;ranked:null|{
   rating:number;rank:number;wins:number;losses:number;draws:number;matches:number;
  };
 }|null}>('select public.get_public_player_profile($1) as get_public_player_profile',[id]))
  .rows[0].get_public_player_profile;
}
async function search(q:string,limit=10){
 return (await db.query<{search_player_profiles:{id:string;nickname:string}[]}>(
  'select public.search_player_profiles($1,$2) as search_player_profiles',[q,limit]
 )).rows[0].search_player_profiles;
}
async function settings(discoverable:boolean,stats:boolean){
 return (await db.query<{set_my_player_profile_settings:{discoverable:boolean;showRankedStats:boolean}}>(
  'select public.set_my_player_profile_settings($1,$2) as set_my_player_profile_settings',
  [discoverable,stats]
 )).rows[0].set_my_player_profile_settings;
}
describe('Profile V1: authenticated discovery and per-player privacy',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"')");
  for(const f of [
   '202610280001_initial_schema.sql',
   '202610280006_ranked_queue_and_rating.sql',
   '202610280010_profile_nickname.sql',
   '202610290003_player_profile_discovery.sql'
  ])await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  await as(a);
  await db.query('select public.set_my_nickname($1)',['Alpha__One']);
  await as(b);
  await db.query('select public.set_my_nickname($1)',['AlphaTwo']);
  await as(c);
  await db.query('select public.set_my_nickname($1)',['오리온']);
 },30000);
 afterAll(async()=>{await db?.close();});
 it('shows public nicknames with literal substring and bounded limits, no email or other metadata',async()=>{
  await as(a);
  const rows=await search('AlPhA');
  expect(rows.map(x=>x.nickname)).toEqual(['Alpha__One','AlphaTwo']);
  expect((await search('__')).map(x=>x.nickname)).toEqual(['Alpha__One']);
  expect((await search('오리')).map(x=>x.nickname)).toEqual(['오리온']);
  expect((await search('Alpha',1))).toHaveLength(1);
  expect(Object.keys(rows[0]).sort()).toEqual(['id','nickname']);
  await expect(search('a')).rejects.toThrow('INVALID_PLAYER_QUERY');
  await expect(search('%_')).rejects.toThrow('INVALID_PLAYER_QUERY');
  await expect(search('Alpha',21)).rejects.toThrow('INVALID_PLAYER_LIMIT');
  await expect(search('Alpha',0)).rejects.toThrow('INVALID_PLAYER_LIMIT');
 });
 it('returns owner settings with safe defaults and never permits direct writes',async()=>{
  await as(a);
  const initial=(await db.query<{get_my_player_profile_settings:unknown}>(
   'select public.get_my_player_profile_settings()')).rows[0].get_my_player_profile_settings;
  expect(initial).toEqual({discoverable:true,showRankedStats:true});
  const mine=await profile(a);
  expect(mine?.ranked).toMatchObject({rating:1000,wins:0,losses:0,draws:0,matches:0});
  expect(mine?.isSelf).toBe(true);
  await expect(db.query("update public.profiles set rating=99999 where id=$1",[a]))
   .rejects.toThrow(/permission denied/);
  await expect(db.query('insert into public.player_profile_settings(user_id) values($1)',[a]))
   .rejects.toThrow(/permission denied/);
  await expect(db.query("update public.player_profile_settings set discoverable=false where user_id=$1",[a]))
   .rejects.toThrow(/permission denied/);
  expect(await settings(true,false)).toEqual({discoverable:true,showRankedStats:false});
  const persisted=(await db.query<{discoverable:boolean;show_ranked_stats:boolean}>(
   'select discoverable,show_ranked_stats from public.player_profile_settings where user_id=$1',[a]
  )).rows[0];
  expect(persisted).toEqual({discoverable:true,show_ranked_stats:false});
  await expect(db.query('select public.set_my_player_profile_settings(NULL,true)'))
   .rejects.toThrow('INVALID_SETTINGS');
 });
 it('hides only a strangers ranked stats while leaving the owner stats visible',async()=>{
  await as(b);
  expect((await profile(a))?.ranked).toBe(null);
  expect((await profile(b))?.ranked).toMatchObject({rating:1000,matches:0});
  expect((await profile(a))?.nickname).toBe('Alpha__One');
  await as(a);
  expect((await profile(a))?.ranked?.rating).toBe(1000);
 });
 it('omits a hidden player from search and direct lookups, while self remains accessible',async()=>{
  await as(b);
  await settings(false,false);
  expect((await profile(b))?.isSelf).toBe(true);
  await as(a);
  expect((await search('Alpha')).map(x=>x.id)).not.toContain(b);
  expect(await profile(b)).toBe(null);
  expect(await profile('99999999-9999-9999-9999-999999999999')).toBe(null);
  // A hidden user can still search other discoverable players.
  await as(b);
  expect((await search('Alpha')).map(x=>x.id)).toContain(a);
  await settings(true,true);
  await as(a);
  expect((await search('Alpha')).map(x=>x.id)).toContain(b);
  expect((await profile(b))?.ranked).toMatchObject({rating:1000});
 });
 it('does not expose another users private settings table or grant anonymous RPCs',async()=>{
  await as(a);
  await settings(false,true);
  await as(b);
  const rows=(await db.query('select * from public.player_profile_settings where user_id=$1',[a])).rows;
  expect(rows).toHaveLength(0);
  await db.exec('reset role;set role anon');
  await expect(db.query("select public.search_player_profiles('Alpha',10)")).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.get_public_player_profile('"+a+"')")).rejects.toThrow(/permission denied/);
  await expect(db.query('select public.get_my_player_profile_settings()')).rejects.toThrow(/permission denied/);
  await expect(db.query('select public.set_my_player_profile_settings(true,true)')).rejects.toThrow(/permission denied/);
 });
});
