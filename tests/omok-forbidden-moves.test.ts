import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { omokRpcError } from '../src/lib/omok/http';
import { blackMoveResult } from '../src/lib/omok/black-rules';
import { type OmokBoard } from '../src/lib/omok/engine';

const black = '11111111-1111-4111-8111-111111111111';
const white = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const migration = '20261106070823_omok_forbidden_moves.sql';
const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const cross = [[7,6],[7,8],[6,7],[8,7],[7,7]];
const spare = [[0,0],[0,2],[2,0],[2,2]];
const request = (i: number) => 'ffffffff-ffff-4fff-8fff-' + String(i).padStart(12,'0');
let db: PGlite;
let legacy: string;
let legacyAi: string;

function board(stones: readonly (readonly number[])[], blocks: number[][] = [], color = 'black') {
  const cells: (string | null)[][] = Array.from({length: 15}, () => Array(15).fill(null));
  for (const [r,c] of stones) cells[r][c] = color;
  for (const [r,c] of blocks) cells[r][c] = 'white';
  return JSON.stringify(cells);
}

async function as(user: string, role = 'authenticated') {
  await db.exec('reset role; set role ' + role);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}

async function rpc<T>(name: string, args: (string | number | null)[] = []) {
  const params = args.map((_, i) => '$' + (i + 1)).join(',');
  return (await db.query<{ result: T }>('select public.' + name + '(' + params + ') as result', args)).rows[0].result;
}

async function casual(code: string) {
  await as(black);
  const room = await rpc<string>('create_omok_room', [code]);
  await as(white);
  await rpc('join_omok_room', [code]);
  await as(black);
  return rpc<string>('start_omok_match', [room]);
}

async function playCross(id: string) {
  const { rows: [match] } = await db.query<{black_id:string; white_id:string}>(
    'select black_id,white_id from public.omok_matches where id=$1', [id],
  );
  for (let i=0; i<spare.length; i++) {
    const turn = i*2 + 1;
    await as(match.black_id);
    await rpc('play_omok_move', [id,request(turn),turn,...cross[i]]);
    await as(match.white_id);
    await rpc('play_omok_move', [id,request(turn+1),turn+1,...spare[i]]);
  }
  await as(match.black_id);
}

async function assertRejected(id: string) {
  await playCross(id);
  const args = [id,request(9),9,7,7];
  await expect(rpc('play_omok_move', args)).rejects.toThrow('OMOK_FORBIDDEN_DOUBLE_THREE');
  const { rows: [snapshot] } = await db.query(
    "select rule_set,turn_no,status,winner_id,board_state#>>'{7,7}' as cell from public.omok_matches where id=$1", [id],
  );
  expect(snapshot).toEqual({rule_set:'black_forbidden',turn_no:9,status:'active',winner_id:null,cell:null});
  expect((await db.query('select 1 from public.omok_moves where match_id=$1 and turn_no=9',[id])).rows).toEqual([]);
  const legal = [id,request(9),9,10,10];
  expect(await rpc('play_omok_move', legal)).toMatchObject({turnNo:10,replayed:false});
  expect(await rpc('play_omok_move', legal)).toMatchObject({turnNo:10,replayed:true});
}

describe('Omok per-match forbidden moves', () => {
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
      insert into auth.users(id) values ('${black}'),('${white}'),('${outsider}');
    `);
    for (const file of readdirSync(migrationDir).filter(file=>file.endsWith('.sql') && file<migration).sort()) {
      await db.exec(readFileSync(new URL(file,migrationDir),'utf8'));
    }
    legacy = await casual('FREEPLAY');
    legacyAi = await rpc('create_omok_ai_match',['normal']);
    await db.exec('reset role');
    await db.exec(readFileSync(new URL(migration,migrationDir),'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it.each([
    ['true cross', cross, [], 'double_three'],
    ['broken three', [[7,5],[7,8],[6,7],[8,7],[7,7]], [], 'double_three'],
    ['blocked extensions', cross, [[7,4],[7,10]], null],
    ['board edge', [[0,6],[0,8],[1,7],[2,7],[0,7]], [], null],
    ['extension creates an overline', [[7,5],[7,8],[6,7],[8,7],[3,6],[4,6],[5,6],[6,6],[8,6],[7,7]], [], null],
    ['extension creates another forbidden double three', [[7,5],[7,8],[6,7],[8,7],[6,6],[8,6],[8,5],[7,7]], [], null],
    ['a single open four', [[7,5],[7,6],[7,8],[7,7]], [], null],
    ['two fours on one axis', [[7,4],[7,6],[7,8],[7,10],[7,7]], [], 'double_four'],
    ['pure overline', [[7,4],[7,5],[7,6],[7,8],[7,9],[7,7]], [], 'overline'],
    ['exact five with a second-axis overline', [[7,5],[7,6],[7,8],[7,9],[4,7],[5,7],[6,7],[8,7],[9,7],[7,7]], [], 'five'],
  ] as [string,number[][],number[][],string|null][])('classifies %s', async (_name, stones, blocks, expected) => {
    await db.exec('reset role');
    const [r,c] = stones.at(-1)!;
    const { rows: [{ result }] } = await db.query<{result:string|null}>(
      'select private.omok_black_move_result($1::jsonb,$2,$3) as result', [board(stones,blocks),r,c],
    );
    expect(result).toBe(expected);
    const snapshot = board(stones,blocks);
    const cells: OmokBoard = JSON.parse(snapshot);
    expect(blackMoveResult(cells,{row:r,col:c})).toBe(expected);
    expect(JSON.stringify(cells)).toBe(snapshot);
  });

  it('accepts a white cross and counts a white overline as a win', async () => {
    await db.exec('reset role');
    for (const [stones,won] of [[cross,false],[[[7,4],[7,5],[7,6],[7,8],[7,9],[7,7]],true]] as const) {
      const {rows:[{result}]} = await db.query<{result:boolean}>(
        "select private.omok_validate_move($1::jsonb,7,7,'white','black_forbidden') as result",
        [board(stones,[],'white')],
      );
      expect(result).toBe(won);
    }
  });

  it('keeps existing PvP and AI matches on freestyle', async () => {
    await as(black);
    const { rows: [old] } = await db.query('select rule_set from public.omok_matches where id=$1',[legacy]);
    const { rows: [oldAi] } = await db.query('select rule_set from public.omok_ai_matches where id=$1',[legacyAi]);
    expect(old).toEqual({rule_set:'freestyle'});
    expect(oldAi).toEqual({rule_set:'freestyle'});
    await playCross(legacy);
    expect(await rpc('play_omok_move',[legacy,request(9),9,7,7])).toMatchObject({status:'active',turnNo:10});
    await rpc('forfeit_omok_match',[legacy]);
  });

  it('blocks direct casual RPC placement atomically and keeps request replay', async () => {
    const id = await casual('NFRPLAYA');
    await assertRejected(id);
    await rpc('forfeit_omok_match',[id]);
  });

  it('blocks ranked placement without settling RP and settles a later exact five once', async () => {
    await as(black);
    await rpc('join_omok_ranked_queue');
    await as(white);
    const { matchId } = await rpc<{matchId:string}>('join_omok_ranked_queue');
    await assertRejected(matchId);
    await db.exec('reset role');
    expect((await db.query('select 1 from public.omok_rating_history where match_id=$1',[matchId])).rows).toEqual([]);
    await as(outsider);
    await expect(rpc('play_omok_move',[matchId,request(12),10,0,1])).rejects.toThrow('MATCH_NOT_FOUND');
    await db.exec('reset role');
    const {rows:[players]} = await db.query<{black_id:string; white_id:string}>(
      'select black_id,white_id from public.omok_matches where id=$1',[matchId],
    );
    for (let i=0; i<4; i++) {
      const turn = 10 + i*2;
      await as(players.white_id);
      await rpc('play_omok_move',[matchId,request(turn),turn,0,4+i*2]);
      await as(players.black_id);
      const args = [matchId,request(turn+1),turn+1,10,11+i];
      const result = await rpc('play_omok_move',args);
      if (i===3) {
        expect(result).toMatchObject({status:'finished',winnerId:players.black_id,finishReason:'five'});
        expect(await rpc('play_omok_move',args)).toMatchObject({replayed:true});
      }
    }
    await db.exec('reset role');
    const {rows:[ledger]} = await db.query(
      'select count(*)::int as entries,sum(delta)::int as balance from public.omok_rating_history where match_id=$1',[matchId],
    );
    expect(ledger).toEqual({entries:2,balance:0});
  });

  it('blocks AI settlement without inserting a turn and retains original board', async () => {
    await as(black);
    const id = await rpc<string>('create_omok_ai_match',['normal']);
    await as(black,'service_role');
    const read = async () => (await db.query<{board_state:unknown;turn_no:number}>(
      'select board_state,turn_no from public.omok_ai_matches where id=$1',[id],
    )).rows[0];
    for (let i=0; i<spare.length; i++) {
      const {board_state} = await read();
      await rpc('commit_omok_ai_turn',[id,black,request(i+1),i+1,JSON.stringify(board_state),...cross[i],...spare[i]]);
    }
    const before = await read();
    await expect(rpc('commit_omok_ai_turn',[id,black,request(5),5,JSON.stringify(before.board_state),7,7,7,9]))
      .rejects.toThrow('OMOK_FORBIDDEN_DOUBLE_THREE');
    expect(await read()).toEqual(before);
    expect((await db.query('select 1 from public.omok_ai_turns where match_id=$1 and turn_no=5',[id])).rows).toEqual([]);
  });

  it('maps forbidden errors to explicit 422 responses', () => {
    for (const code of ['OMOK_FORBIDDEN_DOUBLE_THREE','OMOK_FORBIDDEN_DOUBLE_FOUR','OMOK_FORBIDDEN_OVERLINE']) {
      expect(omokRpcError({message:code})).toEqual({error:code,status:422});
    }
  });
});
