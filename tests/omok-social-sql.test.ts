import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const c = '33333333-3333-4333-8333-333333333333';
let db: PGlite;
let roomId = '', matchId = '';
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const req = (n: number) => 'bbbbbbbb-bbbb-4bbb-8bbb-' + String(n).padStart(12, '0');
async function as(id: string) {
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub'," + quote(id) + ",false)");
}
async function rpc<T = unknown>(name: string, args: string): Promise<T> {
  return (await db.query<Record<string, T>>(`select public.${name}(${args})`)).rows[0][name];
}

describe('Omok participant-only chat and serialized rematches', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $q$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $q$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create publication supabase_realtime;
      insert into auth.users(id) values ('${a}'),('${b}'),('${c}');
    `);
    for (const file of [
      '202610280001_initial_schema.sql', '202611030001_omok_casual_core.sql',
      '202611030002_omok_social_and_rematch.sql',
    ]) await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    await as(a); roomId = await rpc<string>('create_omok_room',quote('OMOK2345').replace('OMOK','ABCD'));
    await as(b); await rpc('join_omok_room',quote('ABCD2345'));
    await as(a); matchId = await rpc<string>('start_omok_match',quote(roomId));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('locks new tables, RLS and grants down to participants', async () => {
    for (const table of ['omok_match_messages','omok_rematch_votes']) {
      const result = await db.query<{rls:boolean,can_write:boolean}>(
        `select c.relrowsecurity as rls,has_table_privilege('authenticated','public.${table}','INSERT,UPDATE,DELETE') as can_write
         from pg_class c where c.oid='public.${table}'::regclass`
      );
      expect(result.rows[0]).toEqual({rls:true,can_write:false});
    }
    await as(c);
    expect((await db.query('select * from public.omok_match_messages')).rows).toHaveLength(0);
    await expect(rpc('send_omok_match_message',`${quote(matchId)},'Intrusion',${quote(req(9))}`))
      .rejects.toThrow('MATCH_NOT_FOUND');
  });

  it('sends chat privately, rejects replay mismatch and allows exact retry', async () => {
    await as(a);
    const args = `${quote(matchId)},'Hello world',${quote(req(1))}`;
    const first = await rpc<{id:string;replayed:boolean}>('send_omok_match_message',args);
    expect(first.replayed).toBe(false);
    expect((await rpc<{id:string;replayed:boolean}>('send_omok_match_message',args)))
      .toEqual({id:first.id,replayed:true});
    await expect(rpc('send_omok_match_message',`${quote(matchId)},'Other',${quote(req(1))}`))
      .rejects.toThrow('REQUEST_CONFLICT');
    await expect(rpc('send_omok_match_message',`${quote(matchId)},'  ',${quote(req(2))}`))
      .rejects.toThrow('INVALID_MESSAGE');
    await as(b);
    const messages = await db.query<{body:string}>('select body from public.omok_match_messages');
    expect(messages.rows).toEqual([{body:'Hello world'}]);
    await as(c);
    expect((await db.query('select * from public.omok_match_messages')).rows).toHaveLength(0);
  });

  it('starts one rematch only when both players vote and alternates colors', async () => {
    await as(b);
    await expect(rpc('vote_omok_rematch',quote(roomId))).rejects.toThrow('MATCH_ACTIVE');
    await rpc('forfeit_omok_match',quote(matchId));
    await as(a);
    const waiting=await rpc<{status:string;readyCount:number}>('vote_omok_rematch',quote(roomId));
    expect(waiting).toMatchObject({status:'waiting',readyCount:1});
    const retry=await rpc<{status:string;readyCount:number}>('vote_omok_rematch',quote(roomId));
    expect(retry).toMatchObject({status:'waiting',readyCount:1});
    await as(b);
    const started=await rpc<{status:string;readyCount:number;matchId:string}>('vote_omok_rematch',quote(roomId));
    expect(started).toMatchObject({status:'started',readyCount:2});
    expect(started.matchId).not.toBe(matchId);
    const newMatch=await db.query<{black_id:string;white_id:string;turn_user_id:string}>(
      'select black_id,white_id,turn_user_id from public.omok_matches where id='+quote(started.matchId)
    );
    expect(newMatch.rows[0]).toMatchObject({black_id:b,white_id:a,turn_user_id:b});
    await expect(rpc('vote_omok_rematch',quote(roomId))).rejects.toThrow('MATCH_ACTIVE');
    const matches=await db.query<{count:string}>('select count(*) from public.omok_matches');
    expect(Number(matches.rows[0].count)).toBe(2);
  });
});
