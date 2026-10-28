import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000011';
const b='00000000-0000-0000-0000-000000000012';
let matchId='';
async function as(id:string){await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");}
describe('P3 server-clock timeout and atomic settlement',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"')");
  for(const name of [
    '202610280001_initial_schema.sql','202610280002_casual_rooms.sql',
    '202610280003_casual_game.sql','202610280004_rematch.sql',
    '202610280005_initial_board_balance.sql','202610280006_ranked_queue_and_rating.sql',
    '202610280007_ranked_atomic_settlement.sql','202610280008_turn_deadline_recovery.sql'
  ])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await as(a);
  await db.exec('select public.join_ranked_queue()');
  await as(b);
  matchId=(await db.query<{join_ranked_queue:{matchId:string}}>('select public.join_ranked_queue()')).rows[0].join_ranked_queue.matchId;
 },30000);
 afterAll(async()=>{await db?.close()});
 it('grants timeout execution only to the server role',async()=>{
  await as(a);
  await expect(db.query("select public.expire_match('"+matchId+"')")).rejects.toThrow(/permission denied/);
 });
 it('does not finalize before the deadline',async()=>{
  await db.exec('reset role;set role service_role;');
  const result=(await db.query<{expire_match:{expired:boolean,status:string}}>("select public.expire_match('"+matchId+"')")).rows[0].expire_match;
  expect(result).toMatchObject({expired:false,status:'active'});
 });
 it('finalizes once and produces exactly two rated ledger entries',async()=>{
  await db.exec("update public.matches set turn_deadline=now()-interval '1 second' where id='"+matchId+"'");
  const result=(await db.query<{expire_match:{expired:boolean,status:string,winnerId:string}}>("select public.expire_match('"+matchId+"')")).rows[0].expire_match;
  expect(result).toMatchObject({expired:true,status:'finished',winnerId:b});
  const again=(await db.query<{expire_match:{expired:boolean}}>("select public.expire_match('"+matchId+"')")).rows[0].expire_match;
  expect(again.expired).toBe(false);
  expect((await db.query("select * from public.rating_history where match_id='"+matchId+"'")).rows).toHaveLength(2);
  const rp=(await db.query<{rating:number}>("select rating from public.profiles where id='"+b+"'")).rows[0].rating;
  expect(rp).toBe(1016);
 });
});
