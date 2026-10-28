import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {describe,it,expect,afterAll,beforeAll} from 'vitest';

let db:PGlite;
const a='00000000-0000-0000-0000-000000000011';
const b='00000000-0000-0000-0000-000000000012';
const c='00000000-0000-0000-0000-000000000013';
const request='00000000-0000-0000-0000-000000000098';
async function as(id:string){await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");}
describe('casual game transaction and RLS',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  await db.exec("create schema realtime;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"');");
  for(const f of ['202610280001_initial_schema.sql','202610280002_casual_rooms.sql','202610280003_casual_game.sql','202610280005_initial_board_balance.sql'])
   await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 },30000);
 afterAll(async()=>{await db?.close()});
 it('restricts game start to room owner and two occupied seats',async()=>{
  await as(a);
  const room=(await db.query<{create_casual_room:string}>("select public.create_casual_room('ABCD2345')")).rows[0].create_casual_room;
  await expect(db.query("select public.start_casual_match('"+room+"')")).rejects.toThrow('NEED_TWO_PLAYERS');
  await as(b);
  await db.query("select public.join_casual_room('ABCD2345')");
  await expect(db.query("select public.start_casual_match('"+room+"')")).rejects.toThrow('NOT_HOST');
  await as(a);
  const match=(await db.query<{start_casual_match:string}>("select public.start_casual_match('"+room+"')")).rows[0].start_casual_match;
  expect(match).toBeTruthy();
  const result=await db.query<{board_state:{pieces:unknown[]}}>("select board_state from public.matches where id='"+match+"'");
  expect(result.rows[0].board_state.pieces).toHaveLength(10);
  expect(result.rows[0].board_state.pieces).toEqual(expect.arrayContaining([
   expect.objectContaining({id:'a1',x:175}),
   expect.objectContaining({id:'b1',x:625}),
  ]));
 });
 it('denies authenticated callers direct state mutation and score forgery',async()=>{
  await as(a);
  await expect(db.query("select public.forfeit_casual_match('00000000-0000-0000-0000-000000000099','"+a+"')")).rejects.toThrow(/permission denied/);
  await expect(db.query("update public.matches set status='finished'")).rejects.toThrow(/permission denied/);
 });
 it('atomically commits one turn and rejects stale turn or duplicate request',async()=>{
  await as(a);
  const m=(await db.query<{id:string,board_state:unknown}>("select id,board_state from public.matches")).rows[0];
  const input=JSON.stringify({expectedBoard:m.board_state,finished:false});
  const result=JSON.stringify(m.board_state);
  await db.exec("reset role;set role service_role;");
  const statement="select public.commit_casual_shot('"+m.id+"','"+a+"',1,'"+request+"','a1','"+input.replaceAll("'","''")+"','"+result.replaceAll("'","''")+"',null)";
  expect((await db.query(statement)).rows).toHaveLength(1);
  await expect(db.query(statement)).rejects.toThrow('STALE_TURN');
  const wrong=statement.replace("',1,'"+request+"'", "',2,'"+request+"'");
  await expect(db.query(wrong)).rejects.toThrow('STALE_TURN');
  const turn=(await db.query<{turn_no:number}>("select turn_no from public.matches where id='"+m.id+"'")).rows[0];
  expect(turn.turn_no).toBe(2);
 });
});
