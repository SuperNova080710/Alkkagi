import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const c='33333333-3333-4333-8333-333333333333';
let db:PGlite;
async function actor(id:string){
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function rpc<T=unknown>(name:string,args:unknown[]=[]){
  const places=args.map((_,i)=>'$'+(i+1)).join(',');
  return (await db.query<{result:T}>('select public.'+name+'('+places+') as result',args)).rows[0].result;
}
async function createMatch(mode='casual'){
  await db.exec('reset role;');
  let roomId:string|null=null;
  if(mode==='casual'){
    roomId=(await db.query<{id:string}>(
      "insert into public.rooms(code,owner_id) values(substr(upper(replace(gen_random_uuid()::text,'-','')),1,8),$1) returning id",[a]
    )).rows[0].id;
  }
  return (await db.query<{id:string}>(
    "insert into public.matches(room_id,mode,player1_id,player2_id,turn_user_id,board_state,turn_deadline) values($1,$2,$3,$4,$3,'{}',null) returning id",
    [roomId,mode,a,b]
  )).rows[0].id;
}
async function finish(id:string,winner:string|null){
  await db.exec('reset role;');
  await db.query("update public.matches set status='finished',winner_id=$2,finished_at=now(),turn_deadline=null where id=$1",[id,winner]);
}
async function awards(id:string){
  await db.exec('reset role;');
  return (await db.query<{source_kind:string;xp_amount:number;outcome:string}>(
    'select source_kind,xp_amount,outcome from public.xp_events where user_id=$1 order by id',[id]
  )).rows;
}
async function progress(id:string){
  await actor(id);
  return rpc<{totalXp:number;level:number;currentLevelXp:number;nextLevelAt:number;
    recentRewards:{earnedXp:number}[]}>('get_player_experience',[id]);
}
describe('XP V1 SQL: authoritative finished-game awards',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
    await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"')");
    for(const file of ['202610280001_initial_schema.sql','202610280002_casual_rooms.sql',
      '202610280003_casual_game.sql','202610280006_ranked_queue_and_rating.sql',
      '202610280007_ranked_atomic_settlement.sql','202610280008_turn_deadline_recovery.sql',
      '202610290002_ai_rooms.sql','202610290003_player_profile_discovery.sql',
      '202610290008_xp_levels_v1.sql'])
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  },30000);
  beforeEach(async()=>{
    await db.exec('reset role;truncate public.xp_events,public.player_progress,public.rating_history,public.ai_turns,public.ai_matches,public.shots,public.matches,public.room_players,public.rooms restart identity cascade;');
    await db.exec('truncate public.player_profile_settings;');
  },30000);
  afterAll(async()=>{await db?.close()});

  it('restricts all direct XP writes and anonymous access',async()=>{
    await actor(a);
    expect(await progress(a)).toMatchObject({totalXp:0,level:1,nextLevelAt:100,recentRewards:[]});
    await expect(db.query('update public.player_progress set total_xp=999 where user_id=$1',[a]))
      .rejects.toThrow(/permission denied/i);
    await expect(db.query("insert into public.xp_events(user_id,source_kind,source_id,outcome,xp_amount) values($1,'casual',$2,'win',90)",[a,b]))
      .rejects.toThrow(/permission denied/i);
    await db.exec('reset role;set role anon;');
    await expect(rpc('get_player_experience',[a])).rejects.toThrow(/permission denied/i);
    await actor(c);
    expect((await db.query('select * from public.xp_events where user_id=$1',[a])).rows).toEqual([]);
  },30000);

  it('awards casual win/loss just once, keeps existing RP unchanged',async()=>{
    const id=await createMatch();await finish(id,a);
    expect(await awards(a)).toEqual([{source_kind:'casual',xp_amount:40,outcome:'win'}]);
    expect(await awards(b)).toEqual([{source_kind:'casual',xp_amount:20,outcome:'loss'}]);
    await db.exec('reset role;');
    await db.query("update public.matches set status='finished',finished_at=now() where id=$1",[id]);
    expect(await awards(a)).toHaveLength(1);
    expect((await progress(a)).totalXp).toBe(40);
    await actor(a);
    expect((await db.query<{rating:number}>('select rating from public.profiles where id=$1',[a])).rows[0].rating).toBe(1000);
  },30000);

  it('awards draws, and ranked forfeit still settles rating and separate XP',async()=>{
    await finish(await createMatch(),null);
    expect((await awards(a))[0]).toMatchObject({xp_amount:25,outcome:'draw'});
    const id=await createMatch('ranked');
    await db.exec('reset role;set role service_role;');
    await rpc('forfeit_casual_match',[id,b]);
    expect((await awards(a))[1]).toMatchObject({source_kind:'ranked',xp_amount:70,outcome:'win'});
    expect((await awards(b))[1]).toMatchObject({source_kind:'ranked',xp_amount:35,outcome:'loss'});
    await db.exec('reset role;');
    expect((await db.query<{total:string}>(
      'select count(*)::text as total from public.rating_history where match_id=$1',[id]
    )).rows[0].total).toBe('2');
    expect((await progress(a)).totalXp).toBe(95);
  },30000);

  it('awards AI victory by difficulty and zero for AI forfeit',async()=>{
    await db.exec('reset role;');
    async function createAi(difficulty:string){
      const roomId=(await db.query<{id:string}>(
        "insert into public.rooms(code,owner_id,status) values(substr(upper(replace(gen_random_uuid()::text,'-','')),1,8),$1,'playing') returning id",[a]
      )).rows[0].id;
      await db.query("insert into public.ai_matches(room_id,owner_id,difficulty,board_state) values($1,$2,$3,'{}')",[roomId,a,difficulty]);
      return roomId;
    }
    const easy=await createAi('easy');
    await db.query("update public.ai_matches set status='finished',winner_id=$2,finished_at=now() where room_id=$1",[easy,a]);
    const hard=await createAi('hard');
    await db.query("update public.ai_matches set status='finished',winner_id=$2,finished_at=now() where room_id=$1",[hard,a]);
    const lost=await createAi('normal');
    await db.exec('set role service_role;');
    await rpc('forfeit_ai_match',[lost,a]);
    expect((await awards(a)).map(x=>x.xp_amount)).toEqual([10,20,0]);
    expect((await progress(a)).totalXp).toBe(30);
    await db.exec('reset role;');
    await db.query("update public.ai_matches set status='finished' where room_id=$1",[easy]);
    expect(await awards(a)).toHaveLength(3);
  },30000);

  it('caps casual repeated opponents at five a day, with zero-XP audit event',async()=>{
    for(let i=0;i<6;i++)await finish(await createMatch(),a);
    expect((await awards(a)).map(x=>x.xp_amount)).toEqual([40,40,40,40,40,0]);
    expect((await awards(b)).map(x=>x.xp_amount)).toEqual([20,20,20,20,20,0]);
    expect(await progress(a)).toMatchObject({totalXp:200,level:2,currentLevelXp:100,nextLevelAt:400});
  },30000);

  it('caps twenty total PvP games per UTC day across all PvP modes',async()=>{
    await db.exec('reset role;');
    await db.query("insert into public.xp_events(user_id,source_kind,source_id,outcome,xp_amount) select $1::uuid,'ranked',('aaaaaaaa-aaaa-4aaa-8aaa-' || lpad(to_hex(n),12,'0'))::uuid,'win',0 from generate_series(1,20) n",[a]);
    await finish(await createMatch('ranked'),a);
    expect((await awards(a)).at(-1)?.xp_amount).toBe(0);
    expect((await awards(b))[0].xp_amount).toBe(35);
  },30000);

  it('caps AI rewards after ten finished games per UTC day',async()=>{
    await db.exec('reset role;');
    await db.query("insert into public.xp_events(user_id,source_kind,source_id,outcome,xp_amount) select $1::uuid,'ai',('bbbbbbbb-bbbb-4bbb-8bbb-' || lpad(to_hex(n),12,'0'))::uuid,'loss',0 from generate_series(1,10) n",[a]);
    const r=(await db.query<{id:string}>(
      "insert into public.rooms(code,owner_id,status) values('AIROOM99',$1,'playing') returning id",[a]
    )).rows[0].id;
    await db.query("insert into public.ai_matches(room_id,owner_id,difficulty,board_state) values($1,$2,'hard','{}')",[r,a]);
    await db.query("update public.ai_matches set status='finished',winner_id=$2,finished_at=now() where room_id=$1",[r,a]);
    expect((await awards(a)).at(-1)?.xp_amount).toBe(0);
    expect((await progress(a)).totalXp).toBe(0);
  },30000);

  it('crosses level 3 boundary on cumulative ranked rewards',async()=>{
    for(let i=0;i<6;i++)await finish(await createMatch('ranked'),a);
    const info=await progress(a);
    expect(info).toMatchObject({totalXp:420,level:3,currentLevelXp:20,nextLevelAt:900});
  },30000);

  it('hides private profiles and never exposes history to another authenticated user',async()=>{
    await finish(await createMatch(),a);
    await actor(b);
    const publicResult=await rpc<{totalXp:number;recentRewards:null}>('get_player_experience',[a]);
    expect(publicResult).toMatchObject({totalXp:40,recentRewards:null});
    await actor(a);
    await rpc('set_my_player_profile_settings',[false,false]);
    await actor(b);
    expect(await rpc('get_player_experience',[a])).toBeNull();
    expect(await rpc('get_player_experience',['99999999-9999-4999-8999-999999999999'])).toBeNull();
  },30000);
});
