import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as roomsPost } from '../src/app/api/chess/rooms/route';
import { GET as roomGet, POST as roomPost } from '../src/app/api/chess/rooms/[id]/route';
import { GET as matchGet, POST as matchPost } from '../src/app/api/chess/matches/[id]/route';
import { initialChessState } from '../src/lib/chess/engine';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/user', () => ({getVerifiedUser: async () => actor ? {id: actor} : null}));
vi.mock('@/lib/supabase/server', () => ({createClient: async () => ({
  rpc: (name: string, args: Record<string, unknown>) => rpc('authenticated', actor, name, args),
})}));
vi.mock('@/lib/supabase/admin', () => ({createAdminClient: () => ({
  rpc: (name: string, args: Record<string, unknown>) => rpc('service_role', null, name, args),
})}));

const white = '11111111-1111-4111-8111-111111111111';
const black = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const requestId = (n: number) => 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(n).padStart(12, '0');
const migrationDir = new URL('../supabase/migrations/', import.meta.url);
let db: PGlite;
let actor: string | null = null;

async function rpc(role: string, user: string | null, name: string, args: Record<string, unknown>) {
  const values = Object.values(args);
  try {
    const data = await db.transaction(async tx => {
      await tx.exec('set local role ' + role);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? '']);
      const params = values.map((_, i) => '$' + (i + 1)).join(',');
      return (await tx.query<{data: unknown}>(
        'select public.' + name + '(' + params + ') as data', values,
      )).rows[0].data;
    });
    return {data, error: null};
  } catch (error) {
    return {data: null, error};
  }
}

const request = (body?: Record<string, unknown>) => new Request('https://example.test/api/chess', body ? {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
} : undefined);
const params = (id: string) => ({params: Promise.resolve({id})});
const move = (ply: number, from: string, to: string, n = ply + 10) =>
  ({action: 'move', ply, from, to, requestId: requestId(n)});

async function create(n: number) {
  actor = white;
  const created = await roomsPost(request({action: 'create', requestId: requestId(n)}));
  expect(created.status).toBe(200);
  const {data: {roomId}} = await created.json();
  const {data: room} = await (await roomGet(request(), params(roomId))).json();
  return {roomId: roomId as string, code: room.code as string};
}

async function start(roomId: string, code: string) {
  actor = black;
  const join = await roomsPost(request({action: 'join', code}));
  expect(await join.json()).toEqual({data: {roomId}});
  actor = white;
  const {data: {matchId}} = await (await roomPost(request({action: 'start'}), params(roomId))).json();
  return matchId as string;
}

describe('chess casual API and authoritative database', () => {
  beforeAll(async () => {
    vi.stubEnv('CHESS_UI_ENABLED', 'true');
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
      insert into auth.users(id) values ('${white}'),('${black}'),('${outsider}');
    `);
    for (const file of readdirSync(migrationDir).filter(file => file.endsWith('.sql')).sort())
      await db.exec(readFileSync(new URL(file,migrationDir),'utf8'));
  }, 30000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await db?.close();
  });

  it('defaults to feature-disabled, and requires authentication before writes', async () => {
    vi.stubEnv('CHESS_UI_ENABLED', 'false');
    expect((await roomsPost(request({action: 'create', requestId: requestId(1)}))).status).toBe(404);
    vi.stubEnv('CHESS_UI_ENABLED', 'true');
    actor = null;
    expect((await roomsPost(request({action: 'create', requestId: requestId(1)}))).status).toBe(401);
  });

  it('creates and starts one private room, preserving IDs on retries', async () => {
    const {roomId, code} = await create(1);
    expect((await roomPost(request({action: 'start'}), params(roomId))).status).toBe(409);
    expect((await create(1)).roomId).toBe(roomId);
    actor = outsider;
    expect((await roomGet(request(), params(roomId))).status).toBe(404);
    const matchId = await start(roomId, code.toLowerCase());
    expect(await (await roomPost(request({action: 'start'}), params(roomId))).json()).toEqual({data: {matchId}});
    expect(await (await roomGet(request(), params(roomId))).json()).toMatchObject({
      data: {status: 'started', matchId, hostId: white, guestId: black},
    });
    const snapshot = await (await matchGet(request(), params(matchId))).json();
    expect(snapshot).toMatchObject({data: {fen: initialChessState().initialFen, ply: 0, turnUserId: white, moves: []}});
    actor = outsider;
    expect((await matchGet(request(), params(matchId))).status).toBe(404);
    expect((await matchPost(request({action: 'resign', requestId: requestId(5)}), params(matchId))).status).toBe(404);
  });

  it('checks legal moves and turns, commits mate and returns the same ordered board to both users', async () => {
    const {roomId, code} = await create(2);
    const matchId = await start(roomId, code);
    const send = (body: Record<string, unknown>) => matchPost(request(body), params(matchId));
    actor = black;
    expect(await (await send(move(0,'e7','e5'))).json()).toEqual({error: 'NOT_YOUR_TURN'});
    actor = white;
    expect(await (await send(move(0,'e2','e5'))).json()).toEqual({error: 'INVALID_MOVE'});
    const first = move(0,'f2','f3');
    expect(await (await send({...first, fen: 'untrusted', winnerId: white})).json())
      .toMatchObject({data: {ply: 1, winnerId: null, moves: [{san: 'f3'}]}});
    expect(await (await send(first)).json()).toMatchObject({data: {ply: 1}});
    expect(await (await send({...first, to: 'f4'})).json()).toEqual({error: 'REQUEST_CONFLICT'});
    expect(await (await send(move(0,'f2','f3',25))).json()).toEqual({error: 'STALE_TURN'});
    actor = black;
    expect((await send(move(1,'e7','e5'))).status).toBe(200);
    actor = white;
    expect((await send(move(2,'g2','g4'))).status).toBe(200);
    actor = black;
    const last = move(3,'d8','h4');
    const result = await (await send(last)).json();
    expect(result).toMatchObject({data: {status:'finished', winnerId:black, finishReason:'checkmate', turnUserId:null}});
    expect(result.data.moves.map((m: {san: string}) => m.san)).toEqual(['f3','e5','g4','Qh4#']);
    expect(await (await send(last)).json()).toEqual(result);
    actor = white;
    expect(await (await matchGet(request(), params(matchId))).json()).toEqual(result);
    expect(await (await send(move(4,'e2','e3'))).json()).toEqual({error:'MATCH_FINISHED'});
    expect((await db.query('select rating from public.profiles where id in ($1,$2)',[white,black])).rows)
      .toEqual([{rating:1000},{rating:1000}]);
  });

  it('accepts only one simultaneous move and settles resignation idempotently', async () => {
    const {roomId, code} = await create(3);
    const matchId = await start(roomId, code);
    const send = (body: Record<string, unknown>) => matchPost(request(body), params(matchId));
    const replies = await Promise.all([send(move(0,'d2','d4',31)),send(move(0,'e2','e4',32))]);
    expect(replies.map(reply => reply.status).sort()).toEqual([200,409]);
    const resign = {action:'resign',requestId:requestId(33)};
    const result = await (await send(resign)).json();
    expect(result).toMatchObject({data: {ply:1,winnerId:black,finishReason:'resignation'}});
    expect(await (await send(resign)).json()).toEqual(result);
    actor = black;
    expect(await (await send(resign)).json()).toEqual({error:'REQUEST_CONFLICT'});
  });

  it('persists a repetition draw without a winner', async () => {
    const {roomId, code} = await create(5);
    const matchId = await start(roomId, code);
    const cycle = [['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8']];
    for (const [ply, [from,to]] of [...cycle, ...cycle].entries()) {
      actor = ply%2 === 0 ? white : black;
      expect((await matchPost(request(move(ply,from,to)),params(matchId))).status).toBe(200);
    }
    expect(await (await matchGet(request(),params(matchId))).json()).toMatchObject({
      data:{status:'finished',ply:8,winnerId:null,finishReason:'threefold-repetition'},
    });
  });

  it('allows lobby exits and denies browser-side mutation RPCs', async () => {
    const {roomId, code} = await create(4);
    actor = black;
    await roomsPost(request({action:'join', code}));
    expect((await roomPost(request({action:'leave'}), params(roomId))).status).toBe(200);
    expect((await roomGet(request(), params(roomId))).status).toBe(404);
    actor = white;
    expect((await roomPost(request({action:'leave'}), params(roomId))).status).toBe(200);
    expect(await (await roomGet(request(), params(roomId))).json()).toMatchObject({data: {status:'closed'}});
    const denied = await rpc('authenticated', white, 'chess_start_match', {p_actor:white,p_room_id:roomId});
    expect(denied.error).toMatchObject({code:'42501'});
    const {rows: [privileges]} = await db.query(`
      select
        has_function_privilege('authenticated',
          'public.chess_commit_move(uuid,uuid,uuid,integer,text,text,text,text,text,boolean,text)','execute') as commit,
        has_function_privilege('authenticated','public.chess_resign(uuid,uuid,uuid)','execute') as resign
    `);
    expect(privileges).toEqual({commit:false,resign:false});
    const {rows: publications} = await db.query(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename like 'chess_%' order by tablename",
    );
    expect(publications).toEqual([{tablename:'chess_matches'},{tablename:'chess_rooms'}]);
    expect(await rpc('anon', null, 'chess_room_snapshot',{p_room_id:roomId}))
      .toMatchObject({error:{code:'42501'}});
  });
});
