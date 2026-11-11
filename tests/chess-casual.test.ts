import { NextRequest } from 'next/server';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as roomsPost } from '../src/app/api/chess/rooms/route';
import { GET as roomGet, POST as roomPost } from '../src/app/api/chess/rooms/[id]/route';
import { GET as matchGet, POST as matchPost } from '../src/app/api/chess/matches/[id]/route';
import { GET as chatGet, POST as chatPost } from '../src/app/api/chess/matches/[id]/messages/route';
import { GET as rankGet, POST as rankPost } from '../src/app/api/chess/ranked/route';
import { GET as invitesGet, POST as invitesPost } from '../src/app/api/chess/invites/route';
import { POST as inviteRespond } from '../src/app/api/chess/invites/[id]/respond/route';
import { GET as invitesSent } from '../src/app/api/chess/invites/sent/route';
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
const inviteRequest = (body: Record<string, unknown>, origin = 'https://example.test') =>
  new NextRequest('https://example.test/api/chess/invites', {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin}, body: JSON.stringify(body),
  });
const sentRequest = (roomId: string) => new NextRequest('https://example.test/api/chess/invites/sent?roomId=' + roomId);
const params = (id: string) => ({params: Promise.resolve({id})});
const move = (ply: number, from: string, to: string, n = ply + 10) =>
  ({action: 'move', ply, from, to, requestId: requestId(n)});

async function create(n: number, host = white) {
  actor = host;
  const created = await roomsPost(request({action: 'create', requestId: requestId(n)}));
  expect(created.status).toBe(200);
  const {data: {roomId}} = await created.json();
  const {data: room} = await (await roomGet(request(), params(roomId))).json();
  return {roomId: roomId as string, code: room.code as string};
}

async function start(roomId: string, code: string, host = white, guest = black) {
  actor = guest;
  const join = await roomsPost(request({action: 'join', code}));
  expect(await join.json()).toEqual({data: {roomId}});
  actor = host;
  const {data: {matchId}} = await (await roomPost(request({action: 'start'}), params(roomId))).json();
  return matchId as string;
}

describe('chess casual API and authoritative database', () => {
  beforeAll(async () => {
    vi.stubEnv('CHESS_UI_ENABLED', 'true');
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('ROOM_INVITES_UI_ENABLED', 'true');
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
      "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename like 'chess_%' and tablename<>'chess_match_messages' order by tablename",
    );
    expect(publications).toEqual([{tablename:'chess_matches'},{tablename:'chess_rooms'}]);
    expect(await rpc('anon', null, 'chess_room_snapshot',{p_room_id:roomId}))
      .toMatchObject({error:{code:'42501'}});
  });
  it('matches two accounts, expires a turn and settles only chess RP once', async () => {
    actor = white;
    expect(await (await rankPost(request({action:'join'}))).json()).toMatchObject({data:{status:'queued'}});
    expect(await (await rankPost(request({action:'cancel'}))).json()).toMatchObject({data:{status:'idle'}});
    await rankPost(request({action:'join'}));
    actor = black;
    const queued = await (await rankPost(request({action:'join'}))).json();
    expect(queued).toMatchObject({data:{status:'matched'}});
    const id = queued.data.matchId as string;
    actor = white;
    expect(await (await rankGet()).json()).toEqual(queued);
    const {data: game} = await (await matchGet(request(),params(id))).json();
    expect(game).toMatchObject({mode:'ranked',status:'active',roomId:null,deadline:expect.any(String)});
    expect(await (await matchPost(request({action:'expire'}),params(id))).json())
      .toMatchObject({data:{status:'active'}});
    await db.query("update public.chess_matches set turn_deadline=now()-interval '1 second' where id=$1",[id]);
    actor = game.whiteId;
    expect(await (await matchPost(request(move(0,'e2','e4')),params(id))).json())
      .toEqual({error:'TURN_EXPIRED'});
    const result = await (await matchPost(request({action:'expire'}),params(id))).json();
    expect(result).toMatchObject({data:{status:'finished',finishReason:'timeout',winnerId:game.blackId,ply:0,deadline:null}});
    expect(await (await matchPost(request({action:'expire'}),params(id))).json()).toEqual(result);
    const {rows:[ledger]} = await db.query(
      'select count(*)::int as entries,sum(delta)::int as net from public.chess_rating_events where match_id=$1',[id],
    );
    expect(ledger).toEqual({entries:2,net:0});
    expect((await db.query('select rating from public.profiles where id in ($1,$2)',[white,black])).rows)
      .toEqual([{rating:1000},{rating:1000}]);
  });

  it('limits invitations to friends and their own inbox, then joins and starts the same room', async () => {
    const {roomId} = await create(6);
    const send = () => invitesPost(inviteRequest({roomId, targetId:black}));
    expect((await send()).status).toBe(404);
    await db.query("insert into public.friend_links(requester_id,recipient_id,status) values($1,$2,'accepted')", [white,black]);
    expect((await invitesPost(inviteRequest({roomId,targetId:black}, 'https://other.test'))).status).toBe(403);
    const {data: invite} = await (await send()).json();
    expect(invite).toMatchObject({inviteId:expect.any(String),alreadyPending:false});
    expect(await (await send()).json()).toMatchObject({data:{inviteId:invite.inviteId,alreadyPending:true}});
    expect(await (await invitesSent(sentRequest(roomId))).json()).toMatchObject({data:[{id:invite.inviteId,status:'pending'}]});
    const accept = () => inviteRespond(inviteRequest({accept:true}),params(invite.inviteId));
    actor = outsider;
    expect(await (await invitesGet()).json()).toEqual({data:[]});
    expect((await accept()).status).toBe(404);
    expect((await invitesSent(sentRequest(roomId))).status).toBe(404);
    expect(await rpc('authenticated', outsider, 'chess_list_received_invites', {actor:black}))
      .toMatchObject({error:{code:'42501'}});
    actor = black;
    expect(await (await invitesGet()).json()).toMatchObject({data:[{id:invite.inviteId,roomId,inviterId:white}]});
    expect(await (await accept()).json()).toEqual({data:{inviteId:invite.inviteId,status:'accepted',roomId}});
    expect((await accept()).status).toBe(200);
    expect(await (await invitesGet()).json()).toEqual({data:[]});
    expect(await (await roomGet(request(),params(roomId))).json()).toMatchObject({data:{guestId:black}});
    actor = white;
    expect(await (await invitesSent(sentRequest(roomId))).json()).toMatchObject({data:[{status:'accepted'}]});
    expect((await roomPost(request({action:'start'}),params(roomId))).status).toBe(200);
  });

  it('rechecks blocks, invitation expiry and room capacity before accepting', async () => {
    const {roomId,code} = await create(7);
    const {data: invite} = await (await invitesPost(inviteRequest({roomId,targetId:black}))).json();
    const accept = () => inviteRespond(inviteRequest({accept:true}),params(invite.inviteId));
    actor = black;
    await db.query('insert into public.player_blocks(blocker_id,blocked_id) values($1,$2)', [black,white]);
    expect(await (await invitesGet()).json()).toEqual({data:[]});
    expect((await accept()).status).toBe(404);
    await db.query('delete from public.player_blocks where blocker_id=$1 and blocked_id=$2', [black,white]);
    await db.query("update public.chess_friend_invites set expires_at=now()-interval '1 minute',created_at=now()-interval '6 minutes' where id=$1", [invite.inviteId]);
    expect((await accept()).status).toBe(404);
    await db.query("update public.chess_friend_invites set expires_at=now()+interval '5 minutes',created_at=now() where id=$1", [invite.inviteId]);
    const joinArgs = {p_actor:outsider,p_code:code};
    const acceptArgs = {actor:black,p_invite_id:invite.inviteId,p_accept:true};
    const competing = await Promise.all([
      rpc('service_role',null,'chess_join_room',joinArgs),
      rpc('service_role',null,'chess_respond_friend_invite',acceptArgs),
    ]);
    expect(competing.filter(reply => !reply.error)).toHaveLength(1);
    actor = white;
    expect(await (await roomGet(request(),params(roomId))).json()).toMatchObject({
      data:{guestId:competing[0].error ? black : outsider},
    });
    await roomPost(request({action:'leave'}),params(roomId));
  });

  it('honors the invitation feature flag and records a decline without joining', async () => {
    const {roomId} = await create(8);
    vi.stubEnv('ROOM_INVITES_UI_ENABLED', 'false');
    expect((await invitesGet()).status).toBe(404);
    vi.stubEnv('ROOM_INVITES_UI_ENABLED', 'true');
    const {data: invite} = await (await invitesPost(inviteRequest({roomId,targetId:black}))).json();
    actor = black;
    expect(await (await inviteRespond(inviteRequest({accept:false}),params(invite.inviteId))).json())
      .toEqual({data:{inviteId:invite.inviteId,status:'declined',roomId:null}});
    expect((await roomGet(request(),params(roomId))).status).toBe(404);
    actor = white;
    expect((await invitesPost(inviteRequest({roomId,targetId:black}))).status).toBe(409);
    await roomPost(request({action:'leave'}),params(roomId));
  });

  it('sends private casual chat, preserves retry IDs and isolates each match', async () => {
    const firstRoom = await create(91);
    const first = await start(firstRoom.roomId,firstRoom.code);
    const nextRoom = await create(92,black);
    const next = await start(nextRoom.roomId,nextRoom.code,black,white);
    const send = (id:string,body:string,req:number) => chatPost(request({body,requestId:requestId(req)}),params(id));
    const read = (id:string) => chatGet(request(),params(id));

    actor = null;
    expect((await read(first)).status).toBe(401);
    actor = outsider;
    expect((await read(first)).status).toBe(404);
    expect((await send(first,'hello',101)).status).toBe(404);
    expect(await rpc('authenticated',outsider,'chess_send_chat_message',{
      p_actor:white,p_match_id:first,p_body:'hello',p_request_id:requestId(101),
    })).toMatchObject({error:{code:'42501'}});

    actor = white;
    expect((await send(first,'  ',101)).status).toBe(400);
    const created = await (await send(first,'  victory  ',101)).json();
    expect(created).toEqual({data:{id:expect.any(String)}});
    expect(await (await send(first,'victory',101)).json()).toEqual(created);
    expect(await (await send(first,'different',101)).json()).toEqual({error:'REQUEST_CONFLICT'});
    expect((await send(next,'too soon',102)).status).toBe(429);
    actor = black;
    expect((await send(first,'good game',102)).status).toBe(200);
    expect(await (await read(first)).json()).toMatchObject({data:[
      {id:created.data.id,sender_id:white,body:'victory'},
      {sender_id:black,body:'good game'},
    ]});
    expect(await (await read(next)).json()).toEqual({data:[]});

    expect((await matchPost(request({action:'resign',requestId:requestId(103)}),params(first))).status).toBe(200);
    await db.query("update public.chess_matches set finished_at=now()-interval '31 minutes' where id=$1",[first]);
    expect(await (await send(first,'closed',104)).json()).toEqual({error:'CHAT_CLOSED'});
    expect(await (await send(first,'good game',102)).json()).toMatchObject({data:{id:expect.any(String)}});
  });

  it('denies ranked chat at the API and RLS layers', async () => {
    expect((await db.query("select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chess_match_messages'")).rows)
      .toHaveLength(1);
    const {rows:[ranked]} = await db.query<{id:string}>(`
      insert into public.chess_matches(mode,white_id,black_id) values('ranked',$1,$2) returning id
    `,[white,black]);
    actor = white;
    expect((await chatGet(request(),params(ranked.id))).status).toBe(403);
    expect((await chatPost(request({body:'hello',requestId:requestId(105)}),params(ranked.id))).status).toBe(403);
    // Privileged fixture to assert the table policy independently of the write RPC.
    await db.query("insert into public.chess_match_messages(match_id,sender_id,request_id,body) values($1,$2,$3,'hidden')",
      [ranked.id,white,requestId(105)]);
    const messages = await db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[white]);
      return tx.query('select id from public.chess_match_messages where match_id=$1',[ranked.id]);
    });
    expect(messages.rows).toEqual([]);
  });

});
