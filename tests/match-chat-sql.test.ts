import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
const a='00000000-0000-0000-0000-000000000011';
const b='11111111-1111-1111-1111-111111111112';
const c='22222222-2222-2222-2222-222222222223';
let db:PGlite;
let matchId='';
async function as(id:string){
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function send(match:string,content:string){
 return db.query<{send_match_message:string}>('select public.send_match_message($1,$2) as send_match_message',[match,content]);
}
describe('P3 private match chat and rate protection',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"')");
  for(const file of [
   '202610280001_initial_schema.sql','202610280002_casual_rooms.sql',
   '202610280003_casual_game.sql','202610280004_rematch.sql',
   '202610280005_initial_board_balance.sql','202610280006_ranked_queue_and_rating.sql',
   '202610280007_ranked_atomic_settlement.sql','202610280008_turn_deadline_recovery.sql',
   '202610280009_shot_rate_limit.sql','202610280010_profile_nickname.sql',
   '202610290001_match_chat.sql'
  ])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await as(a);
  const room=(await db.query<{create_casual_room:string}>(
   "select public.create_casual_room('CHAT1234')")).rows[0].create_casual_room;
  await as(b);
  await db.query("select public.join_casual_room('CHAT1234')");
  await as(a);
  matchId=(await db.query<{start_casual_match:string}>(
   "select public.start_casual_match('"+room+"')")).rows[0].start_casual_match;
 },30000);
 afterAll(async()=>{await db?.close()});
 it('allows only match participants to read and post, with no client INSERT access',async()=>{
  await as(c);
  expect((await db.query("select * from public.match_messages")).rows).toHaveLength(0);
  await expect(send(matchId,'outsider')).rejects.toThrow('MATCH_NOT_FOUND');
  await expect(db.query("insert into public.match_messages(match_id,sender_id,body) values($1,$2,'fake')",[matchId,c]))
   .rejects.toThrow(/permission denied/);
  await db.exec('reset role;set role anon');
  await expect(send(matchId,'anonymous')).rejects.toThrow(/permission denied/);
  await expect(db.query('select * from public.match_messages')).rejects.toThrow(/permission denied/);
 });
 it('stores a trimmed message; both players can read it, outsiders cannot',async()=>{
  await as(a);
  const inserted=(await send(matchId,'  안녕하세요!  ')).rows[0].send_match_message;
  expect(inserted).toBeTruthy();
  expect((await db.query<{body:string}>('select body from public.match_messages')).rows.map(x=>x.body)).toEqual(['안녕하세요!']);
  await as(b);
  expect((await db.query<{body:string}>('select body from public.match_messages')).rows[0].body).toBe('안녕하세요!');
  await as(c);
  expect((await db.query('select * from public.match_messages')).rows).toHaveLength(0);
 });
 it('enforces message length and sending interval atomically',async()=>{
  await as(a);
  await expect(send(matchId,' ')).rejects.toThrow('MESSAGE_INVALID');
  await expect(send(matchId,'a'.repeat(281))).rejects.toThrow('MESSAGE_INVALID');
  await expect(send(matchId,'다음 메시지')).rejects.toThrow('CHAT_RATE_LIMIT');
  await db.exec('reset role;set role service_role;');
  await db.exec("update public.match_messages set created_at=now()-interval '2 seconds' where sender_id='"+a+"'");
  await as(a);
  expect((await send(matchId,'다음 메시지')).rows).toHaveLength(1);
 });
 it('permits messages shortly after finishing, then closes the match chat',async()=>{
  await db.exec('reset role;set role service_role;');
  await db.exec("update public.matches set status='finished',winner_id='"+a+"',finished_at=now(),turn_deadline=null where id='"+matchId+"'");
  await as(b);
  expect((await send(matchId,'좋은 경기였습니다')).rows).toHaveLength(1);
  await db.exec('reset role;set role service_role;');
  await db.exec("update public.matches set finished_at=now()-interval '31 minutes' where id='"+matchId+"'");
  await as(a);
  await expect(send(matchId,'late')).rejects.toThrow('CHAT_CLOSED');
 });
});
