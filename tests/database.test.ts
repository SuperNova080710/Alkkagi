import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ids = {
  a: '00000000-0000-0000-0000-000000000001',
  b: '00000000-0000-0000-0000-000000000002',
  c: '00000000-0000-0000-0000-000000000003',
  room: '10000000-0000-0000-0000-000000000001',
  match: '20000000-0000-0000-0000-000000000001',
};
let db: PGlite;
async function asUser(id: string) {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
}

describe('initial schema against PostgreSQL (PGlite, simulated Supabase roles)', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      insert into auth.users values ('${ids.a}');
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/202610280001_initial_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`
      insert into auth.users values ('${ids.b}'), ('${ids.c}');
      insert into public.rooms(id, code, owner_id) values ('${ids.room}', 'ABC123', '${ids.a}');
      insert into public.room_players(room_id,user_id,seat) values ('${ids.room}','${ids.a}',1), ('${ids.room}','${ids.b}',2);
      insert into public.matches(id,room_id,player1_id,player2_id,turn_user_id,board_state)
      values ('${ids.match}','${ids.room}','${ids.a}','${ids.b}','${ids.a}','{}');
      insert into public.shots(match_id,turn_no,request_id,player_id,piece_id,input,result_state)
      values ('${ids.match}',1,'30000000-0000-0000-0000-000000000001','${ids.a}','a1','{}','{}');
    `);
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('backfills existing users and creates new profiles through the trigger', async () => {
    await db.exec('reset role');
    const result = await db.query('select rating, ranked_wins from profiles');
    expect(result.rows).toHaveLength(3);
    expect(result.rows).toEqual(expect.arrayContaining([{ rating: 1000, ranked_wins: 0 }]));
  });
  it.each([ids.a, ids.b])('only returns the caller profile for %s', async id => {
    await asUser(id);
    expect((await db.query('select id from profiles')).rows).toEqual([{ id }]);
  });
  it.each([ids.a, ids.b])('allows both participants to read their room, match and shots: %s', async id => {
    await asUser(id);
    for (const table of ['rooms', 'matches', 'shots']) expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
    expect((await db.query('select user_id from room_players')).rows).toEqual([{ user_id: id }]);
  });
  it('hides all game records from a third user', async () => {
    await asUser(ids.c);
    for (const table of ['rooms', 'room_players', 'matches', 'shots']) expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
  });
  it('denies unauthenticated reads despite permissive pre-existing default privileges', async () => {
    await db.exec('reset role; set role anon');
    for (const table of ['profiles','rooms','room_players','matches','shots']) {
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
    }
  });
  it('rejects client rating/board changes and inserts/deletes even for the owner', async () => {
    await asUser(ids.a);
    const writes = [
      `update profiles set rating=9999 where id='${ids.a}'`,
      `update matches set board_state='{"cheat":true}' where id='${ids.match}'`,
      `insert into rooms(code,owner_id) values ('HACK01','${ids.a}')`,
      `delete from room_players where user_id='${ids.a}'`,
      'delete from shots',
    ];
    for (const sql of writes) await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
  });
  it('enforces seat, duplicate user, code, shot turn and request uniqueness', async () => {
    await db.exec('reset role');
    const writes = [
      `insert into room_players values ('${ids.room}','${ids.c}',2,now())`,
      `insert into room_players values ('${ids.room}','${ids.c}',3,now())`,
      `insert into room_players values ('${ids.room}','${ids.a}',2,now())`,
      `insert into rooms(code,owner_id) values ('ABC123','${ids.b}')`,
      `insert into shots(match_id,turn_no,request_id,player_id,piece_id,input,result_state) values ('${ids.match}',1,gen_random_uuid(),'${ids.a}','a1','{}','{}')`,
      `insert into shots(match_id,turn_no,request_id,player_id,piece_id,input,result_state) values ('${ids.match}',2,'30000000-0000-0000-0000-000000000001','${ids.a}','a1','{}','{}')`,
    ];
    for (const sql of writes) await expect(db.exec(sql)).rejects.toThrow(/constraint/);
  });
  it('permits trusted service writes (not a substitute for endpoint authorization)', async () => {
    await db.exec('reset role; set role service_role');
    await db.exec(`update profiles set nickname='player_A' where id='${ids.a}'`);
    expect((await db.query(`select nickname from profiles where id='${ids.a}'`)).rows).toEqual([{ nickname: 'player_A' }]);
  });
});
