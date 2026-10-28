import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000011';
const b='00000000-0000-0000-0000-000000000012';
const stranger='00000000-0000-0000-0000-000000000013';
let room:string,first:string;
async function as(id:string) {
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
describe('rematch atomicity and authorizations',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+stranger+"')");
  for (const f of ['202610280001_initial_schema.sql','202610280002_casual_rooms.sql','202610280003_casual_game.sql','202610280004_rematch.sql'])
   await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  await as(a);
  room=(await db.query<{create_casual_room:string}>("select public.create_casual_room('ABCD2345')")).rows[0].create_casual_room;
  await as(b);
  await db.exec("select public.join_casual_room('ABCD2345')");
  await as(a);
  first=(await db.query<{start_casual_match:string}>("select public.start_casual_match('"+room+"')")).rows[0].start_casual_match;
 },30000);
 afterAll(async()=>{await db?.close();});
 it('refuses rematch before the first match finishes',async()=>{
  await as(a);
  await expect(db.query("select public.request_casual_rematch('"+room+"')")).rejects.toThrow('MATCH_NOT_FINISHED');
 });
 it('rejects guests outside the room and direct vote-table writes',async()=>{
  await as(stranger);
  await expect(db.query("select public.request_casual_rematch('"+room+"')")).rejects.toThrow('NOT_PARTICIPANT');
  await expect(db.query("select * from public.rematch_votes")).rejects.toThrow(/permission denied/);
 });
 it('retains the prior match, waits for two votes and creates one new match',async()=>{
  await db.exec("reset role;set role service_role;");
  await db.exec("update public.matches set status='finished',winner_id='"+a+"',finished_at=now() where id='"+first+"'");
  await as(a);
  const vote1=(await db.query<{request_casual_rematch:{started:boolean,readyCount:number}}>("select public.request_casual_rematch('"+room+"')")).rows[0].request_casual_rematch;
  expect(vote1).toMatchObject({started:false,readyCount:1});
  const voteAgain=(await db.query<{request_casual_rematch:{readyCount:number}}>("select public.request_casual_rematch('"+room+"')")).rows[0].request_casual_rematch;
  expect(voteAgain.readyCount).toBe(1);
  const status=(await db.query<{get_casual_room:{rematchReadyCount:number,myRematchVote:boolean}}>("select public.get_casual_room('"+room+"')")).rows[0].get_casual_room;
  expect(status).toMatchObject({rematchReadyCount:1,myRematchVote:true});
  await as(b);
  const vote2=(await db.query<{request_casual_rematch:{started:boolean,matchId:string}}>("select public.request_casual_rematch('"+room+"')")).rows[0].request_casual_rematch;
  expect(vote2.started).toBe(true);
  expect(vote2.matchId).not.toBe(first);
  expect((await db.query("select id from public.matches where room_id='"+room+"'")).rows).toHaveLength(2);
  await expect(db.query("select public.request_casual_rematch('"+room+"')")).rejects.toThrow('MATCH_NOT_FINISHED');
 });
});