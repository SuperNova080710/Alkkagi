import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
let db:PGlite;
let matchId='';
const q=(s:string)=>"'" + s + "'";
const req=(n:number)=>'dddddddd-dddd-4ddd-8ddd-'+String(n).padStart(12,'0');
async function as(id:string) {
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub',"+q(id)+",false)");
}
async function rpc<T>(name:string,args=''):Promise<T> {
  return (await db.query<Record<string,T>>('select public.'+name+'('+args+')')).rows[0][name];
}

describe('Omok ranked is independent from Alkkagi RP',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $q$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $q$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create publication supabase_realtime;
      insert into auth.users(id) values ('${alice}'),('${bob}'),('${outsider}');
    `);
    for(const file of ['202610280001_initial_schema.sql',
      '202611030001_omok_casual_core.sql']) {
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    }
    // The full production migration includes Friends V1. This scoped fixture
    // only stubs its block table to exercise ranked pair exclusions.
    await db.exec(`
      create table public.player_blocks(blocker_id uuid not null,blocked_id uuid not null,
        primary key(blocker_id,blocked_id));
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/202611030004_omok_ranked.sql',import.meta.url),'utf8'));
  },30000);
  afterAll(async()=>{await db?.close();});

  it('creates a queue, matches two different accounts and provides a 90s deadline',async()=>{
    await as(alice);
    expect(await rpc('join_omok_ranked_queue')).toMatchObject({status:'queued',matchId:null});
    expect(await rpc('omok_ranked_queue_status')).toMatchObject({status:'queued'});
    await as(bob);
    const second=await rpc<{status:string;matchId:string}>('join_omok_ranked_queue');
    expect(second.status).toBe('matched'); matchId=second.matchId;
    expect(await rpc('omok_ranked_queue_status')).toMatchObject({status:'matched',matchId});
    const [{rows:matches},{rows:ratings}]=await Promise.all([
      db.query<{room_id:string|null;mode:string;turn_deadline:string}>(
        'select room_id,mode,turn_deadline from public.omok_matches where id='+q(matchId)),
      db.query<{user_id:string;rating:number}>('select user_id,rating from public.omok_ratings'),
    ]);
    expect(matches[0].mode).toBe('ranked');
    expect(matches[0].room_id).toBeNull();
    expect(matches[0].turn_deadline).toBeTruthy();
    expect(ratings).toHaveLength(1); // personal RLS: Bob only
    await as(alice);
    expect(await rpc('omok_ranked_queue_status')).toMatchObject({status:'matched',matchId});
  });

  it('blocks outsiders, role mutation and unapproved rating writes',async()=>{
    await as(outsider);
    expect((await db.query('select * from public.omok_matches')).rows).toHaveLength(0);
    expect((await db.query('select * from public.omok_ratings')).rows).toHaveLength(0);
    expect((await db.query('select * from public.omok_rating_history')).rows).toHaveLength(0);
    await expect(db.query("update public.omok_ratings set rating=50000"))
      .rejects.toThrow(/permission denied/);
    await expect(rpc('expire_omok_ranked_match',q(matchId))).rejects.toThrow('MATCH_NOT_FOUND');
  });

  it('settles one Elo win transactionally and preserves Alkkagi profile rating',async()=>{
    await as(alice);
    const match=(await db.query<{black_id:string;white_id:string}>(
      'select black_id,white_id from public.omok_matches where id='+q(matchId)
    )).rows[0];
    const targets=[
      [0,0],[14,0],[0,1],[14,1],[0,2],[14,2],[0,3],[14,3],[0,4],
    ];
    for(let i=0;i<targets.length;i++){
      await as(i%2===0?match.black_id:match.white_id);
      const [row,col]=targets[i];
      const result=await rpc<{status:string;winnerId:string|null}>(
        'play_omok_move',`${q(matchId)},${q(req(i+1))},${i+1},${row},${col}`
      );
      if(i===8) expect(result).toMatchObject({status:'finished',winnerId:match.black_id});
    }
    await db.exec('reset role;');
    const history=await db.query<{user_id:string;delta:number}>(
      'select user_id,delta from public.omok_rating_history where match_id='+q(matchId)
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows.find(x=>x.user_id===match.black_id)?.delta).toBe(16);
    expect(history.rows.find(x=>x.user_id===match.white_id)?.delta).toBe(-16);
    const profiles=await db.query<{rating:number}>('select rating from public.profiles');
    expect(profiles.rows.every(x=>x.rating===1000)).toBe(true);
    await as(alice);
    const dashboard=await rpc<{rating:number;leaderboard:{nickname:string;rating:number}[]}>('omok_ranked_dashboard');
    expect(dashboard.leaderboard).toHaveLength(2);
    expect(dashboard.leaderboard[0].rating).toBe(1016);
    expect((await rpc<{status:string}>('omok_ranked_queue_status')).status).toBe('idle');
  });

  it('blocks a late turn and settles timeout only after verified expiry',async()=>{
    await as(alice); await rpc('join_omok_ranked_queue');
    await as(bob);
    const second=await rpc<{status:string;matchId:string}>('join_omok_ranked_queue');
    expect(second.status).toBe('matched');
    await expect(rpc('expire_omok_ranked_match',q(second.matchId))).rejects.toThrow('TURN_NOT_EXPIRED');
    await db.exec('reset role;set role service_role;');
    await db.query("update public.omok_matches set turn_deadline=clock_timestamp()-interval '1 minute' where id="+q(second.matchId));
    const game=(await db.query<{turn_user_id:string}>(
      'select turn_user_id from public.omok_matches where id='+q(second.matchId)
    )).rows[0];
    await as(game.turn_user_id);
    await expect(rpc('play_omok_move',`${q(second.matchId)},${q(req(50))},1,7,7`))
      .rejects.toThrow('TURN_EXPIRED');
    const result=await rpc<{winnerId:string;finishReason:string}>(
      'expire_omok_ranked_match',q(second.matchId));
    expect(result.finishReason).toBe('timeout');
    expect(result.winnerId).not.toBe(game.turn_user_id);
    await db.exec('reset role;');
    const entries=await db.query<{count:string}>('select count(*) from public.omok_rating_history where match_id='+q(second.matchId));
    expect(Number(entries.rows[0].count)).toBe(2);
  });
});
