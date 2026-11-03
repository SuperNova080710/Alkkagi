import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
let db:PGlite;
const files=[
  '202610280001_initial_schema.sql','202610280002_casual_rooms.sql',
  '202610280003_casual_game.sql','202610280006_ranked_queue_and_rating.sql',
  '202610280007_ranked_atomic_settlement.sql','202610280008_turn_deadline_recovery.sql',
  '202610290002_ai_rooms.sql','202610290003_player_profile_discovery.sql',
  '202610290005_friends_v1.sql','202610290008_xp_levels_v1.sql',
  '202611030001_omok_casual_core.sql','202611030002_omok_social_and_rematch.sql',
  '202611030003_omok_ai_matches.sql','202611030004_omok_ranked.sql',
  '202611030006_omok_xp.sql',
];
async function events(id:string) {
  const {rows}=await db.query<{source_kind:string;xp_amount:number;outcome:string}>(
    'select source_kind,xp_amount,outcome from public.xp_events where user_id=$1 order by id',[id]);
  return rows;
}
async function newOmokMatch(mode:'casual'|'ranked') {
  const roomId=mode==='casual'?
    (await db.query<{id:string}>(
      "insert into public.omok_rooms(code,owner_id,status) values(substr(translate(upper(replace(gen_random_uuid()::text,'-','')),'01','AB'),1,8),$1,'playing') returning id",[a]
    )).rows[0].id:null;
  if(mode==='ranked') {
    await db.query('insert into public.omok_ratings(user_id) values($1),($2) on conflict do nothing',[a,b]);
  }
  return (await db.query<{id:string}>(
    `insert into public.omok_matches(mode,room_id,black_id,white_id,turn_user_id,board_state)
      values($1,$2,$3,$4,$3,to_jsonb(array_fill(null::text,array[15,15]))) returning id`,
    [mode,roomId,a,b]
  )).rows[0].id;
}
async function finishOmok(id:string,winner:string|null) {
  await db.query("update public.omok_matches set status='finished',winner_id=$2,finish_reason=$3,finished_at=now() where id=$1",
    [id,winner,winner?'five':'draw']);
}
async function createAi(difficulty:string,result:'human'|'ai'|'draw') {
  const id=(await db.query<{id:string}>(
    `insert into public.omok_ai_matches(owner_id,difficulty,board_state)
      values($1,$2,to_jsonb(array_fill(null::text,array[15,15]))) returning id`,
    [a,difficulty])).rows[0].id;
  await db.query("update public.omok_ai_matches set status='finished',winner=$2,finish_reason=$3,finished_at=now() where id=$1",
    [id,result==='draw'?null:result,result==='draw'?'draw':'five']);
  return id;
}

describe('Omok contributes to unified account XP without modifying Alkkagi RP',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`
      create role anon nologin;create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $q$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $q$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create publication supabase_realtime;
      insert into auth.users(id) values ('${a}'),('${b}');
    `);
    for(const file of files)
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  },30000);
  beforeEach(async()=>{
    await db.exec(`reset role;
      truncate public.xp_events,public.player_progress,
        public.omok_rating_history,public.omok_ratings,public.omok_ranked_queue,
        public.omok_ai_turns,public.omok_ai_matches,public.omok_rematch_votes,
        public.omok_match_messages,public.omok_moves,public.omok_matches,
        public.omok_room_players,public.omok_rooms restart identity cascade;`);
  },30000);
  afterAll(async()=>{await db?.close()});

  it('awards 40/20 casual once and leaves legacy Alkkagi profile.rating untouched',async()=>{
    const id=await newOmokMatch('casual');
    await finishOmok(id,a);
    expect(await events(a)).toEqual([{source_kind:'omok_casual',xp_amount:40,outcome:'win'}]);
    expect(await events(b)).toEqual([{source_kind:'omok_casual',xp_amount:20,outcome:'loss'}]);
    await db.query("update public.omok_matches set status='finished' where id=$1",[id]);
    expect(await events(a)).toHaveLength(1);
    const profile=await db.query<{rating:number}>('select rating from public.profiles where id=$1',[a]);
    expect(profile.rows[0].rating).toBe(1000);
  });

  it('awards ranked win/loss and independent Elo simultaneously',async()=>{
    const id=await newOmokMatch('ranked');
    await finishOmok(id,a);
    expect(await events(a)).toEqual([{source_kind:'omok_ranked',xp_amount:70,outcome:'win'}]);
    expect(await events(b)).toEqual([{source_kind:'omok_ranked',xp_amount:35,outcome:'loss'}]);
    const history=await db.query<{count:string}>(
      'select count(*) from public.omok_rating_history where match_id=$1',[id]);
    expect(Number(history.rows[0].count)).toBe(2);
    expect((await db.query<{rating:number}>(
      'select rating from public.profiles where id=$1',[a])).rows[0].rating).toBe(1000);
  });

  it('gives AI wins 10/15/20 XP but gives zero for loss',async()=>{
    await createAi('easy','human');
    await createAi('normal','human');
    await createAi('hard','human');
    await createAi('normal','ai');
    expect((await events(a)).map(x=>x.xp_amount)).toEqual([10,15,20,0]);
    const total=(await db.query<{total_xp:string}>(
      'select total_xp from public.player_progress where user_id=$1',[a])).rows[0].total_xp;
    expect(Number(total)).toBe(45);
  });

  it('caps repeated casual opponents and records zero-XP audit events',async()=>{
    for(let i=0;i<6;i++)await finishOmok(await newOmokMatch('casual'),a);
    expect((await events(a)).map(x=>x.xp_amount)).toEqual([40,40,40,40,40,0]);
    expect((await events(b)).map(x=>x.xp_amount)).toEqual([20,20,20,20,20,0]);
  });
});
