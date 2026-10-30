import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';

type Check={category:string;stage:string;check_key:string;status:string};
const script=readFileSync(
  new URL('../supabase/checks/production-rollout-preflight.sql',import.meta.url),'utf8'
);
let db:PGlite;
const run=async()=> (await db.query<Check>(script)).rows;
const find=(rows:Check[],stage:string,key:string,category='object')=>
  rows.find(x=>x.stage===stage&&x.check_key===key&&x.category===category)?.status;

describe('Production 004–009 migration readiness preflight (read-only)',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec('create role anon nologin; create role authenticated nologin;');
    await db.exec('create publication supabase_realtime;');
    for(const name of [
      'profiles','rooms','room_players','matches','ai_matches','player_profile_settings'
    ]){
      await db.exec('create table public.'+name+' (id uuid primary key)');
    }
  },30000);
  afterAll(async()=>{await db?.close()});

  it('contains a single SELECT query, no commands or mutation statements',()=>{
    const stripped=script.replace(/--[^\n]*/g,'');
    expect(stripped.trimStart().toLowerCase()).toMatch(/^with expected_objects\s*\(/);
    expect(stripped).not.toMatch(/\b(?:insert\s+into|update\s+public|delete\s+from|alter\s+table|drop\s+table|create\s+table|truncate\s+table|grant\s+execute|revoke\s+all|copy\s+.+\s+to)\b/i);
    expect((stripped.match(/;\s*$/g)||[])).toHaveLength(1);
  });

  it('returns all prerequisites ready and future migrations pending on a clean baseline',async()=>{
    const rows=await run();
    expect(rows).toHaveLength(68);
    expect(rows.filter(x=>x.stage==='base')).toHaveLength(7);
    expect(rows.filter(x=>x.stage==='base').every(x=>x.status==='ready')).toBe(true);
    expect(find(rows,'004','public.create_casual_room(text)')).toBe('pending');
    expect(find(rows,'005','public.friend_links')).toBe('pending');
    expect(find(rows,'006','public.dm_messages')).toBe('pending');
    expect(find(rows,'007','public.room_friend_invites')).toBe('pending');
    expect(find(rows,'008','public.player_progress')).toBe('pending');
    expect(find(rows,'009','public.cosmetic_items')).toBe('pending');
    expect(find(rows,'006','supabase_realtime/dm_messages','realtime')).toBe('pending');
    // Repeated inspection must not create any inventory tables or user data.
    expect(await run()).toEqual(rows);
    expect((await db.query<{yes:boolean}>(
      "select to_regclass('public.friend_links') is not null as yes"
    )).rows[0].yes).toBe(false);
  });

  it('detects partially created tables with RLS disabled, then accepts protected permissions',async()=>{
    await db.exec('create table public.friend_links (id uuid primary key);');
    let rows=await run();
    expect(find(rows,'005','public.friend_links')).toBe('ready');
    expect(find(rows,'005','public.friend_links','table-access')).toBe('blocked');

    await db.exec('alter table public.friend_links enable row level security;');
    rows=await run();
    expect(find(rows,'005','public.friend_links','table-access')).toBe('ready');
  });

  it('flags anon-executable RPCs and verifies an authenticated-only grant',async()=>{
    await db.exec('create function public.send_friend_request(uuid) returns int language sql as $$select 1$$;');
    let rows=await run();
    expect(find(rows,'005','public.send_friend_request(uuid)','rpc-access')).toBe('blocked');
    await db.exec('revoke all on function public.send_friend_request(uuid) from public,anon,authenticated; grant execute on function public.send_friend_request(uuid) to authenticated;');
    rows=await run();
    expect(find(rows,'005','public.send_friend_request(uuid)','rpc-access')).toBe('ready');
  });

  it('never treats 004 exception strings in dead code as proof of active limits',async()=>{
    await db.exec('create function public.create_casual_room(text) returns uuid language plpgsql as $begin return null; end;$;');
    expect(find(await run(),'004','public.create_casual_room(text)')).toBe('inspect');
    // The two markers exist but are unreachable. A text check is an unsafe
    // false positive, especially in a production migration STOP gate.
    await db.exec("create or replace function public.create_casual_room(text) returns uuid language plpgsql as $ begin if false then raise exception 'ROOM_ACTIVE_LIMIT'; end if; if false then raise exception 'ROOM_RATE_LIMIT'; end if; return null; end; $;");
    expect(find(await run(),'004','public.create_casual_room(text)')).toBe('inspect');
    await db.exec("create or replace function public.create_casual_room(text) returns uuid language plpgsql as $ begin raise exception 'ROOM_ACTIVE_LIMIT'; end; $;");
    // Even plausible source alone is insufficient: runtime limits must be
    // checked in an isolated DB with the same migration/version.
    expect(find(await run(),'004','public.create_casual_room(text)')).toBe('inspect');
  });
});