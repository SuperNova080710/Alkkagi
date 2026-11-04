import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
let db: PGlite;
let roomId = '';
let matchId = '';
const request = (n: number) => 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(n).padStart(12, '0');
async function as(user: string) {
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','" + user + "',false)");
}
async function call<T extends Record<string, unknown>>(name: string, sqlArgs: string) {
  return (await db.query<T>(`select public.${name}(${sqlArgs})`)).rows[0];
}
function quote(s: string) { return "'" + s.replaceAll("'", "''") + "'"; }

describe('Omok SQL: authoritative casual games and RLS', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $fn$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $fn$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create publication supabase_realtime;
      insert into auth.users(id) values ('${alice}'),('${bob}'),('${outsider}');
    `);
    for (const file of [
      '202610280001_initial_schema.sql',
      '202611030001_omok_casual_core.sql',
    ]) {
      await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('installs participant-only tables, ACL, RPC and Realtime', async () => {
    const tables = ['omok_rooms', 'omok_room_players', 'omok_matches', 'omok_moves'];
    for (const table of tables) {
      const { rows } = await db.query<{ relrowsecurity: boolean }>(
        `select relrowsecurity from pg_class where oid='public.${table}'::regclass`
      );
      expect(rows[0].relrowsecurity).toBe(true);
      for (const role of ['anon', 'authenticated']) {
        const r = await db.query<{ can_write: boolean }>(
          `select has_table_privilege('${role}','public.${table}','INSERT,UPDATE,DELETE') as can_write`
        );
        expect(r.rows[0].can_write).toBe(false);
      }
    }
    const pub = await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename like 'omok_%'"
    );
    expect(pub.rows.map(x => x.tablename).sort()).toEqual(['omok_matches','omok_moves','omok_rooms']);
    const grant = await db.query<{ granted: boolean }>(
      "select has_function_privilege('anon','public.play_omok_move(uuid,uuid,integer,integer,integer)','EXECUTE') as granted"
    );
    expect(grant.rows[0].granted).toBe(false);
  });

  it('creates room, requires two players, verifies host and prevents duplicate start', async () => {
    await as(alice);
    roomId = (await call<{ create_omok_room: string }>('create_omok_room',quote('ABCDEFGH'))).create_omok_room;
    await expect(call('start_omok_match',quote(roomId))).rejects.toThrow('NEED_TWO_PLAYERS');
    await as(bob);
    await expect(call('start_omok_match',quote(roomId))).rejects.toThrow('NOT_HOST');
    expect((await call<{join_omok_room:string}>('join_omok_room',quote('ABCDEFGH'))).join_omok_room).toBe(roomId);
    expect((await call<{join_omok_room:string}>('join_omok_room',quote('ABCDEFGH'))).join_omok_room).toBe(roomId);
    await as(outsider);
    await expect(call('join_omok_room',quote('ABCDEFGH'))).rejects.toThrow('ROOM_FULL');
    await expect(call('get_omok_room',quote(roomId))).rejects.toThrow('ROOM_NOT_FOUND');
    await as(alice);
    const room = await call<{get_omok_room:{players:{userId:string}[]}}>('get_omok_room',quote(roomId));
    expect(room.get_omok_room.players).toHaveLength(2);
    matchId = (await call<{start_omok_match:string}>('start_omok_match',quote(roomId))).start_omok_match;
    await expect(call('start_omok_match',quote(roomId))).rejects.toThrow('ROOM_UNAVAILABLE');
    const match = await db.query<{turn_no:number;board_state:(string|null)[][]}>(
      'select turn_no,board_state from public.omok_matches where id='+quote(matchId)
    );
    expect(match.rows[0].turn_no).toBe(1);
    expect(match.rows[0].board_state).toHaveLength(15);
    expect(match.rows[0].board_state.every(row => row.length===15 && row.every(v=>v===null))).toBe(true);
  });

  it('disallows unauthorised read/write and impersonated forfeits', async () => {
    await as(outsider);
    expect((await db.query('select * from public.omok_matches')).rows).toHaveLength(0);
    expect((await db.query('select * from public.omok_moves')).rows).toHaveLength(0);
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(90))},1,0,0`))
      .rejects.toThrow('MATCH_NOT_FOUND');
    await expect(call('forfeit_omok_match',quote(matchId))).rejects.toThrow('MATCH_NOT_FOUND');
    await expect(db.query("update public.omok_matches set status='finished'")).rejects.toThrow(/permission denied/);
  });

  it('rejects opponent turns, invalid moves and duplicate occupied coordinates', async () => {
    await as(bob);
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(91))},1,1,1`))
      .rejects.toThrow('STALE_TURN');
    await as(alice);
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(92))},1,-1,1`))
      .rejects.toThrow('INVALID_MOVE');
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(93))},1,15,1`))
      .rejects.toThrow('INVALID_MOVE');
    const firstArgs = `${quote(matchId)},${quote(request(1))},1,0,0`;
    const first = await call<{play_omok_move:{replayed:boolean;turnNo:number}}>('play_omok_move',firstArgs);
    expect(first.play_omok_move).toMatchObject({replayed:false,turnNo:2});
    const retry = await call<{play_omok_move:{replayed:boolean;turnNo:number}}>('play_omok_move',firstArgs);
    expect(retry.play_omok_move).toMatchObject({replayed:true,turnNo:2});
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(1))},1,0,1`))
      .rejects.toThrow('REQUEST_CONFLICT');
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(2))},1,0,1`))
      .rejects.toThrow('STALE_TURN');
    await as(bob);
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(2))},2,0,0`))
      .rejects.toThrow('CELL_OCCUPIED');
    const count = await db.query<{count:string}>('select count(*) from public.omok_moves');
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it('detects five-in-a-row, locks finished game, and can forfeit a different match', async () => {
    const turns = [
      { owner:bob, row:14, col:0 }, { owner:alice, row:0, col:1 },
      { owner:bob, row:14, col:1 }, { owner:alice, row:0, col:2 },
      { owner:bob, row:14, col:2 }, { owner:alice, row:0, col:3 },
      { owner:bob, row:14, col:3 }, { owner:alice, row:0, col:4 },
    ];
    let last: Record<string, unknown> = {};
    for (let i=0; i<turns.length; i++) {
      const t=turns[i]; await as(t.owner);
      last=(await call<{play_omok_move:Record<string,unknown>}>(
        'play_omok_move',`${quote(matchId)},${quote(request(i+2))},${i+2},${t.row},${t.col}`
      )).play_omok_move;
    }
    expect(last).toMatchObject({status:'finished',finishReason:'five',winnerId:alice,turnNo:10});
    // The room remains playing for #221 two-party rematch voting. The finished
    // match is immutable, and the core start RPC cannot create another one.
    const roomStatus=await db.query<{status:string}>('select status from public.omok_rooms where id='+quote(roomId));
    expect(roomStatus.rows[0].status).toBe('playing');
    await as(bob);
    await expect(call('play_omok_move',`${quote(matchId)},${quote(request(50))},10,0,5`))
      .rejects.toThrow('MATCH_FINISHED');
    const moves = await db.query<{count:string}>('select count(*) from public.omok_moves');
    expect(Number(moves.rows[0].count)).toBe(9);
    await as(alice);
    const room2 = (await call<{create_omok_room:string}>('create_omok_room',quote('ABCDEFJK'))).create_omok_room;
    await as(bob); await call('join_omok_room',quote('ABCDEFJK'));
    await as(alice);
    const m2 = (await call<{start_omok_match:string}>('start_omok_match',quote(room2))).start_omok_match;
    await as(bob);
    const result=(await call<{forfeit_omok_match:{winnerId:string,finishReason:string}}>('forfeit_omok_match',quote(m2))).forfeit_omok_match;
    expect(result).toEqual({winnerId:alice,finishReason:'forfeit'});
    await expect(call('forfeit_omok_match',quote(m2))).rejects.toThrow('MATCH_FINISHED');
  });
});
