import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
const a='00000000-0000-0000-0000-000000000011';
const b='11111111-1111-1111-1111-111111111112';
const outsider='22222222-2222-2222-2222-222222222223';
let db:PGlite;
async function as(id:string){
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function newRoom(code:string){
 return (await db.query<{create_casual_room:string}>('select public.create_casual_room($1) as create_casual_room',[code])).rows[0].create_casual_room;
}
async function start(roomId:string,difficulty:string){
 return db.query<{start_ai_room:string}>('select public.start_ai_room($1,$2) as start_ai_room',[roomId,difficulty]);
}
describe('P3+ AI opponent in a waiting room',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+outsider+"')");
  for(const f of ['202610280001_initial_schema.sql','202610280002_casual_rooms.sql','202610290002_ai_rooms.sql'])
   await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 },30000);
 afterAll(async()=>{await db?.close()});
 it('starts a room owner only, without creating a fake auth account or ranked record',async()=>{
  await as(a);
  const id=await newRoom('TEST2345');
  await expect(start(id,'invalid')).rejects.toThrow('INVALID_DIFFICULTY');
  await as(b);
  await expect(start(id,'normal')).rejects.toThrow('NOT_HOST');
  await as(a);
  expect((await start(id,'hard')).rows[0].start_ai_room).toBe(id);
  const {rows}=await db.query<{difficulty:string;status:string;board_state:{pieces:{owner:string}[]}}>(
   'select difficulty,status,board_state from public.ai_matches where room_id=$1',[id]);
  expect(rows[0].difficulty).toBe('hard');
  expect(rows[0].status).toBe('active');
  expect(rows[0].board_state.pieces).toHaveLength(10);
  expect(rows[0].board_state.pieces.filter(p=>p.owner===a)).toHaveLength(5);
  expect(rows[0].board_state.pieces.filter(p=>p.owner==='00000000-0000-4000-8000-0000000000a1')).toHaveLength(5);
  expect((await db.query("select count(*)::int as n from auth.users")).rows[0]).toEqual({n:3});
  await expect(start(id,'easy')).rejects.toThrow('ROOM_UNAVAILABLE');
  await as(b);
  await expect(db.query("select public.join_casual_room('TEST2345')")).rejects.toThrow('ROOM_UNAVAILABLE');
  await as(outsider);
  expect((await db.query('select * from public.ai_matches')).rows).toHaveLength(0);
  await db.exec("reset role;set role anon");
  await expect(db.query('select * from public.ai_matches')).rejects.toThrow(/permission denied/);
  await expect(start(id,'easy')).rejects.toThrow(/permission denied/);
 });
 it('prevents AI when a friend already joined, preserving human match',async()=>{
  await as(a);
  const room=await newRoom('HUMN2345');
  await as(b);
  await db.query("select public.join_casual_room('HUMN2345')");
  await as(a);
  await expect(start(room,'normal')).rejects.toThrow('ROOM_HAS_GUEST');
  expect((await db.query<{status:string}>('select status from public.rooms where id=$1',[room])).rows[0].status).toBe('waiting');
 });
 it('limits writes and commits each human+computer turn once',async()=>{
  await as(a);
  const game=(await db.query<{room_id:string;board_state:{pieces:unknown[]}}>('/**/select room_id,board_state from public.ai_matches limit 1')).rows[0];
  const dummy=JSON.stringify(game.board_state), frames=JSON.stringify([game.board_state]);
  await expect(db.query('update public.ai_matches set status=$1 where room_id=$2',['finished',game.room_id]))
   .rejects.toThrow(/permission denied/);
  await expect(db.query("insert into public.ai_turns(room_id,turn_no,human_input,human_frames,result_state) values($1,1,'{}','[]','{}')",[game.room_id]))
   .rejects.toThrow(/permission denied/);
  await db.exec('reset role;set role service_role');
  const args=[game.room_id,a,1,dummy,JSON.stringify({pieceId:'a1',dx:100,dy:0}),
   frames,JSON.stringify({pieceId:'b1',dx:-120,dy:0}),frames,dummy,false,null];
  const sql='select public.commit_ai_turn($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)';
  await db.query(sql,args);
  await expect(db.query(sql,args)).rejects.toThrow('STALE_AI_TURN');
  const result=(await db.query<{turn_no:number}>('select turn_no from public.ai_matches where room_id=$1',[game.room_id])).rows[0];
  expect(result.turn_no).toBe(2);
  const turns=(await db.query<{n:number}>('select count(*)::int as n from public.ai_turns where room_id=$1',[game.room_id])).rows[0];
  expect(turns.n).toBe(1);
  const {rows}=await db.query<{n:number}>('select count(*)::int as n from public.matches');
  expect(rows[0].n).toBe(0);
  await as(outsider);
  expect((await db.query('select * from public.ai_turns')).rows).toHaveLength(0);
 });
 it('forfeit is owner-only and cannot double-complete',async()=>{
  await as(a);
  const game=(await db.query<{room_id:string}>('select room_id from public.ai_matches limit 1')).rows[0];
  await db.exec('reset role;set role service_role');
  await expect(db.query('select public.forfeit_ai_match($1,$2)',[game.room_id,outsider]))
   .rejects.toThrow('AI_MATCH_NOT_FOUND');
  expect((await db.query('select public.forfeit_ai_match($1,$2)',[game.room_id,a])).rows).toHaveLength(1);
  await expect(db.query('select public.forfeit_ai_match($1,$2)',[game.room_id,a]))
   .rejects.toThrow('AI_MATCH_FINISHED');
 });
});
