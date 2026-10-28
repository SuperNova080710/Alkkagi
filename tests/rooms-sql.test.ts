import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let db: PGlite;
const users = ['00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000013'];
async function asUser(id:string) {
 await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub', '"+id+"', false);");
}
describe('casual room RPC database invariants', () => {
 beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;");
  await db.exec("insert into auth.users(id) values "+users.map(x=>"('"+x+"')").join(',')+";");
  for(const file of ['202610280001_initial_schema.sql','202610280002_casual_rooms.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 }, 30000);
 afterAll(async()=>{await db?.close()});
 it('blocks anonymous callers',async()=>{
  await db.exec("reset role;set role anon");
  await expect(db.query("select public.create_casual_room('ABCD2345')")).rejects.toThrow();
 });
 it('creates two seats atomically, refuses a third and supports leaving',async()=>{
  await asUser(users[0]);
  const id=(await db.query<{create_casual_room:string}>("select public.create_casual_room('ABCD2345')")).rows[0].create_casual_room;
  expect(id).toBeTruthy();
  await asUser(users[1]);
  const first=await db.query<{join_casual_room:string}>("select public.join_casual_room('ABCD2345')");
  const second=await db.query<{join_casual_room:string}>("select public.join_casual_room('ABCD2345')");
  expect(first.rows).toEqual(second.rows);
  await asUser(users[2]);
  await expect(db.query("select public.join_casual_room('ABCD2345')")).rejects.toThrow('ROOM_FULL');
  await expect(db.query("select public.get_casual_room('"+id+"')")).rejects.toThrow('ROOM_NOT_FOUND');
  await asUser(users[1]);
  await db.query("select public.leave_casual_room('"+id+"')");
  await asUser(users[2]);
  expect((await db.query("select public.join_casual_room('ABCD2345')")).rows).toHaveLength(1);
  await asUser(users[0]);
  await db.query("select public.leave_casual_room('"+id+"')");
  await asUser(users[1]);
  await expect(db.query("select public.join_casual_room('ABCD2345')")).rejects.toThrow('ROOM_UNAVAILABLE');
 });
});
