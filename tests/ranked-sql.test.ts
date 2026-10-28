import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000011';
const b='00000000-0000-0000-0000-000000000012';
const c='00000000-0000-0000-0000-000000000013';
let rankedMatchId='';
async function as(id:string){
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
describe('P2 atomic ranked matching and Elo settlement',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"')");
  for(const name of [
   '202610280001_initial_schema.sql','202610280002_casual_rooms.sql','202610280003_casual_game.sql',
   '202610280004_rematch.sql','202610280005_initial_board_balance.sql',
   '202610280006_ranked_queue_and_rating.sql','202610280007_ranked_atomic_settlement.sql'
  ]) await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 },30000);
 afterAll(async()=>{await db?.close();});
 it('protects queue/ledger against direct anonymous and authenticated writes',async()=>{
  await db.exec('reset role;set role anon');
  await expect(db.query("select public.join_ranked_queue()")).rejects.toThrow(/permission denied/);
  await as(a);
  await expect(db.query("insert into public.ranked_queue(user_id,rating_snapshot) values('"+a+"',999999)")).rejects.toThrow(/permission denied/);
  await expect(db.query('select * from public.rating_history')).resolves.toBeDefined();
  await expect(db.query("select private.settle_ranked_match('"+a+"')")).rejects.toThrow(/permission denied/);
 });
 it('queues once, pairs two users once, and exposes one shared active match',async()=>{
  await as(a);
  expect((await db.query<{join_ranked_queue:{status:string}}>('select public.join_ranked_queue()')).rows[0].join_ranked_queue.status).toBe('queued');
  expect((await db.query<{join_ranked_queue:{status:string}}>('select public.join_ranked_queue()')).rows[0].join_ranked_queue.status).toBe('queued');
  await as(b);
  const status=(await db.query<{join_ranked_queue:{status:string,matchId:string}}>('select public.join_ranked_queue()')).rows[0].join_ranked_queue;
  expect(status.status).toBe('matched');
  rankedMatchId=status.matchId;
  const board=(await db.query<{board_state:{pieces:unknown[]}}>("select board_state from public.matches where id='"+rankedMatchId+"'")).rows[0].board_state;
  expect(board.pieces).toHaveLength(10);
  await as(a);
  expect((await db.query<{ranked_queue_status:{matchId:string}}>('select public.ranked_queue_status()')).rows[0].ranked_queue_status.matchId).toBe(rankedMatchId);
  expect((await db.query<{join_ranked_queue:{matchId:string}}>('select public.join_ranked_queue()')).rows[0].join_ranked_queue.matchId).toBe(rankedMatchId);
  expect((await db.query("select id from public.matches where mode='ranked'")).rows).toHaveLength(1);
 });
 it('supports cancel/renew without affecting the existing ranked match',async()=>{
  await as(c);
  expect((await db.query<{join_ranked_queue:{status:string}}>('select public.join_ranked_queue()')).rows[0].join_ranked_queue.status).toBe('queued');
  expect((await db.query<{cancel_ranked_queue:boolean}>('select public.cancel_ranked_queue()')).rows[0].cancel_ranked_queue).toBe(true);
  expect((await db.query<{ranked_queue_status:{status:string}}>('select public.ranked_queue_status()')).rows[0].ranked_queue_status.status).toBe('idle');
  await as(b);
  await db.exec('select public.cancel_ranked_queue()');
  expect((await db.query("select id from public.matches where id='"+rankedMatchId+"'")).rows).toHaveLength(1);
 });
 it('settles one winning match for +16/-16 and refuses repeat settlement',async()=>{
  await db.exec("reset role;set role service_role;");
  await db.exec("select public.forfeit_casual_match('"+rankedMatchId+"','"+a+"')");
  const profiles=await db.query<{id:string,rating:number,ranked_wins:number,ranked_losses:number}>("select id,rating,ranked_wins,ranked_losses from public.profiles where id in('"+a+"','"+b+"') order by id");
  expect(profiles.rows).toEqual([
   {id:a,rating:984,ranked_wins:0,ranked_losses:1},
   {id:b,rating:1016,ranked_wins:1,ranked_losses:0}
  ]);
  expect((await db.query("select user_id from public.rating_history where match_id='"+rankedMatchId+"'")).rows).toHaveLength(2);
  await expect(db.query("select public.forfeit_casual_match('"+rankedMatchId+"','"+a+"')")).rejects.toThrow('MATCH_FINISHED');
  expect((await db.query("select user_id from public.rating_history where match_id='"+rankedMatchId+"'")).rows).toHaveLength(2);
 });
 it('never settles a casual game and reveals only my finished ranked history',async()=>{
  await as(a);
  const room=(await db.query<{create_casual_room:string}>("select public.create_casual_room('WXYZ2345')")).rows[0].create_casual_room;
  await as(c);
  await db.exec("select public.join_casual_room('WXYZ2345')");
  await as(a);
  const match=(await db.query<{start_casual_match:string}>("select public.start_casual_match('"+room+"')")).rows[0].start_casual_match;
  await db.exec("reset role;set role service_role;");
  await db.exec("select public.forfeit_casual_match('"+match+"','"+a+"')");
  expect((await db.query("select * from public.rating_history where match_id='"+match+"'")).rows).toHaveLength(0);
  await as(a);
  const dashboard=(await db.query<{ranked_dashboard:{rating:number,losses:number,history:unknown[]}}>('select public.ranked_dashboard()')).rows[0].ranked_dashboard;
  expect(dashboard.rating).toBe(984);
  expect(dashboard.losses).toBe(1);
  expect(dashboard.history).toHaveLength(1);
  await as(c);
  expect((await db.query<{ranked_dashboard:{history:unknown[]}}>('select public.ranked_dashboard()')).rows[0].ranked_dashboard.history).toHaveLength(0);
  await expect(db.query("select public.ranked_match_players('"+rankedMatchId+"')")).rejects.toThrow('MATCH_NOT_FOUND');
 });
});