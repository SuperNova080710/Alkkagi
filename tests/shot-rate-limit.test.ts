import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
let db:PGlite;
const u='00000000-0000-0000-0000-000000000011';
describe('server-only shot rate limiting',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
  await db.exec("insert into auth.users(id) values ('"+u+"')");
  for(const name of ['202610280001_initial_schema.sql','202610280009_shot_rate_limit.sql'])
   await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 },30000);
 afterAll(async()=>{await db?.close()});
 it('rejects authenticated users who try to modify the limiter',async()=>{
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+u+"',false);");
  await expect(db.query("select public.claim_shot_slot('"+u+"')")).rejects.toThrow(/permission denied/);
  await expect(db.query("insert into public.shot_rate_limits(user_id) values('"+u+"')")).rejects.toThrow(/permission denied/);
 });
 it('permits first request and rejects immediate flood, then recovers after interval',async()=>{
  await db.exec("reset role;set role service_role;");
  const claim=()=>db.query<{claim_shot_slot:boolean}>("select public.claim_shot_slot('"+u+"')");
  expect((await claim()).rows[0].claim_shot_slot).toBe(true);
  expect((await claim()).rows[0].claim_shot_slot).toBe(false);
  await db.exec("update public.shot_rate_limits set last_attempt=now()-interval '2 seconds'");
  expect((await claim()).rows[0].claim_shot_slot).toBe(true);
 });
});