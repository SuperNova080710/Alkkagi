import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';

const human='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const req=(n:number)=>'cccccccc-cccc-4ccc-8ccc-'+String(n).padStart(12,'0');
const q=(s:string)=>"'" + s.replaceAll("'","''") + "'";
let db:PGlite;
let matchId='';
async function role(name:string,user=human) {
  await db.exec("reset role;set role "+name+";select set_config('request.jwt.claim.sub',"+q(user)+",false)");
}
async function createMatch(difficulty:string) {
  return (await db.query<{create_omok_ai_match:string}>(
    'select public.create_omok_ai_match('+q(difficulty)+')'
  )).rows[0].create_omok_ai_match;
}
const fresh=()=>Array.from({length:15},()=>Array<string|null>(15).fill(null));
async function setup(board:(string|null)[][],turn:number) {
  await role('authenticated');
  const id=await createMatch('normal');
  await role('service_role');
  await db.query('update public.omok_ai_matches set board_state=$1::jsonb,turn_no=$2 where id=$3',
    [JSON.stringify(board),turn,id]);
  return id;
}
async function commit(id:string,requestId:string,turn:number,board:unknown,
  humanRow:number,humanCol:number,aiRow:number|null,aiCol:number|null) {
  return (await db.query<{commit_omok_ai_turn:{
    status:string;winner:string|null;finishReason:string|null;replayed:boolean;turnNo:number
  }}>(`select public.commit_omok_ai_turn($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
  [id,human,requestId,turn,JSON.stringify(board),humanRow,humanCol,aiRow,aiCol]))
  ).rows[0].commit_omok_ai_turn;
}

describe('Omok AI server settlement',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $q$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $q$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create publication supabase_realtime;
      insert into auth.users(id) values ('${human}'),('${outsider}');
    `);
    for(const file of ['202610280001_initial_schema.sql','202611030003_omok_ai_matches.sql'])
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  },30000);
  afterAll(async()=>{await db?.close()});

  it('protects match and turn tables, commit RPC and ownership',async()=>{
    await role('authenticated');
    matchId=await createMatch('hard');
    await expect(createMatch('expert')).rejects.toThrow('INVALID_DIFFICULTY');
    await expect(db.query("update public.omok_ai_matches set winner='human'"))
      .rejects.toThrow(/permission denied/);
    await expect(db.query("select public.commit_omok_ai_turn("+
      q(matchId)+','+q(human)+','+q(req(99))+",1,'[]',0,0,1,1)"))
      .rejects.toThrow(/permission denied/);
    await role('authenticated',outsider);
    expect((await db.query('select * from public.omok_ai_matches')).rows).toHaveLength(0);
    expect((await db.query('select * from public.omok_ai_turns')).rows).toHaveLength(0);
    await role('service_role');
    const state=(await db.query<{board_state:unknown}>(
      'select board_state from public.omok_ai_matches where id='+q(matchId))).rows[0].board_state;
    await expect(db.query(
      'select public.commit_omok_ai_turn($1,$2,$3,1,$4::jsonb,0,0,1,1)',
      [matchId,outsider,req(98),JSON.stringify(state)]
    )).rejects.toThrow('MATCH_NOT_FOUND');
    // The RPC trusts only a user ID passed by trusted Next.js server code;
    // browser callers cannot EXECUTE this service-only function.
  });

  it('atomically commits human plus AI move and supports exact idempotent retry',async()=>{
    await role('service_role');
    const state=(await db.query<{board_state:unknown}>(
      'select board_state from public.omok_ai_matches where id='+q(matchId))).rows[0].board_state;
    const one=await commit(matchId,req(1),1,state,7,7,7,8);
    expect(one).toMatchObject({status:'active',turnNo:2,replayed:false});
    const replay=await commit(matchId,req(1),1,state,7,7,7,8);
    expect(replay).toMatchObject({status:'active',turnNo:2,replayed:true});
    await expect(commit(matchId,req(1),1,state,8,8,8,7)).rejects.toThrow('REQUEST_CONFLICT');
    await expect(commit(matchId,req(2),1,state,9,9,9,8)).rejects.toThrow('STALE_TURN');
    const turns=await db.query<{count:string}>('select count(*) from public.omok_ai_turns where match_id='+q(matchId));
    expect(Number(turns.rows[0].count)).toBe(1);
    const next=(await db.query<{board_state:(string|null)[][]}>(
      'select board_state from public.omok_ai_matches where id='+q(matchId))).rows[0].board_state;
    expect(next[7][7]).toBe('black'); expect(next[7][8]).toBe('white');
    await expect(commit(matchId,req(2),2,next,7,7,8,8)).rejects.toThrow('CELL_OCCUPIED');
  });

  it('recomputes white and black victory in SQL rather than trusting client result',async()=>{
    const winBoard=fresh();
    for(let col=0;col<4;col++){winBoard[0][col]='black';winBoard[14][col]='white';}
    const winId=await setup(winBoard,5);
    const humanWin=await commit(winId,req(3),5,winBoard,0,4,null,null);
    expect(humanWin).toMatchObject({status:'finished',winner:'human',finishReason:'five'});
    await expect(commit(winId,req(4),6,winBoard,9,9,7,7)).rejects.toThrow('MATCH_FINISHED');
    const aiBoard=fresh();
    for(let col=0;col<4;col++) aiBoard[14][col]='white';
    for(const col of [0,2,4,6]) aiBoard[0][col]='black';
    const aiId=await setup(aiBoard,5);
    const aiWin=await commit(aiId,req(5),5,aiBoard,0,8,14,4);
    expect(aiWin).toMatchObject({status:'finished',winner:'ai',finishReason:'five'});
  });

  it('forfeits only active owner matches and cannot be replayed',async()=>{
    await role('authenticated');
    const id=await createMatch('easy');
    await role('service_role');
    const stmt='select public.forfeit_omok_ai_match('+q(id)+','+q(human)+')';
    const result=(await db.query<{forfeit_omok_ai_match:{winner:string;finishReason:string}}>(stmt))
      .rows[0].forfeit_omok_ai_match;
    expect(result).toEqual({winner:'ai',finishReason:'forfeit'});
    await expect(db.query(stmt)).rejects.toThrow('MATCH_FINISHED');
  });
});
