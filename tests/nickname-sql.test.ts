import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {validNickname} from '../src/lib/profile/nickname';

const a='00000000-0000-0000-0000-000000000011';
const b='00000000-0000-0000-0000-000000000012';
let db:PGlite;
async function acting(id:string){
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function change(name:string){
 return db.query<{set_my_nickname:string}>('select public.set_my_nickname($1) as set_my_nickname',[name]);
}
async function available(name:string){
 return db.query<{check_nickname_available:boolean}>('select public.check_nickname_available($1) as check_nickname_available',[name]);
}
describe('P3 nickname claim, uniqueness and public game display',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"')");
  for(const name of [
    '202610280001_initial_schema.sql','202610280002_casual_rooms.sql',
    '202610280003_casual_game.sql','202610280004_rematch.sql',
    '202610280005_initial_board_balance.sql','202610280006_ranked_queue_and_rating.sql',
    '202610280007_ranked_atomic_settlement.sql','202610280008_turn_deadline_recovery.sql',
    '202610280009_shot_rate_limit.sql','202610280010_profile_nickname.sql'
  ])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 },30000);
 afterAll(async()=>{await db?.close()});
 it('validates public rules consistently with PostgreSQL',()=>{
  for(const nickname of ['오리온','Player_22','유저123','_abcd']){
   expect(validNickname(nickname)).toBe(true);
  }
  for(const nickname of ['a','with space','admin!',' 안녕','a'.repeat(25),'이모지😀']){
   expect(validNickname(nickname)).toBe(false);
  }
 });
 it('preserves preexisting auto-generated nicknames and allows a unique personal rename',async()=>{
  await acting(a);
  const before=(await db.query<{nickname:string,rating:number,ranked_wins:number}>(
   "select nickname,rating,ranked_wins from public.profiles where id='"+a+"'")).rows[0];
  expect(before.nickname).toMatch(/^player_/);
  expect((await available('오리온')).rows[0].check_nickname_available).toBe(true);
  expect((await change('오리온')).rows[0].set_my_nickname).toBe('오리온');
  const after=(await db.query<{nickname:string,rating:number,ranked_wins:number}>(
   "select nickname,rating,ranked_wins from public.profiles where id='"+a+"'")).rows[0];
  expect(after).toEqual({...before,nickname:'오리온'});
  expect((await available('오리온')).rows[0].check_nickname_available).toBe(true);
 });
 it('rejects case-insensitive duplicates even after availability check',async()=>{
  await acting(b);
  expect((await available('오리온')).rows[0].check_nickname_available).toBe(false);
  await expect(change('오리온')).rejects.toThrow('NICKNAME_TAKEN');
  await acting(a);
  expect((await change('Alpha_Test')).rows[0].set_my_nickname).toBe('Alpha_Test');
  await acting(b);
  expect((await available('alpha_test')).rows[0].check_nickname_available).toBe(false);
  await expect(change('alpha_test')).rejects.toThrow('NICKNAME_TAKEN');
  expect((await change('BlueUser')).rows[0].set_my_nickname).toBe('BlueUser');
 });
 it('rejects invalid strings and direct writes to any player profile',async()=>{
  await acting(a);
  for(const invalid of ['a','Hi there','<script>','a'.repeat(25)]){
   await expect(change(invalid)).rejects.toThrow('NICKNAME_INVALID');
  }
  await expect(db.exec("update public.profiles set rating=999999 where id='"+a+"'")).rejects.toThrow(/permission denied/);
  await expect(db.exec("update public.profiles set nickname='TakenOver' where id='"+b+"'")).rejects.toThrow(/permission denied/);
  await db.exec('reset role;set role anon');
  await expect(db.query("select public.check_nickname_available('Alpha_Test')")).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.set_my_nickname('Example')")).rejects.toThrow(/permission denied/);
 });
 it('uses updated names for ranked leaderboard and room participants',async()=>{
  await acting(a);
  const leader=(await db.query<{ranked_dashboard:{leaderboard:{nickname:string}[]}}>('select public.ranked_dashboard()')).rows[0].ranked_dashboard.leaderboard;
  expect(leader.map(x=>x.nickname)).toContain('Alpha_Test');
  expect(leader.map(x=>x.nickname)).toContain('BlueUser');
  const room=(await db.query<{create_casual_room:string}>("select public.create_casual_room('ABCDEFGH')")).rows[0].create_casual_room;
  await acting(b);
  await db.exec("select public.join_casual_room('ABCDEFGH')");
  await acting(a);
  const data=(await db.query<{get_casual_room:{players:{nickname:string}[]}}>("select public.get_casual_room('"+room+"')")).rows[0].get_casual_room;
  expect(data.players.map(x=>x.nickname)).toEqual(['Alpha_Test','BlueUser']);
 });
});
