import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
let db:PGlite;
async function as(id:string){
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function rpc<T=unknown>(name:string,args:unknown[]=[]){
  const params=args.map((_,i)=>'$'+(i+1)).join(',');
  return (await db.query<{value:T}>('select public.'+name+'('+params+') as value',args)).rows[0].value;
}
type Item={code:string;slot:'piece'|'avatar';unlockKind:string;requiredValue:number;owned:boolean;equipped:boolean;unlockedAt:string|null};
type Own={loadout:{pieceCode:string;avatarCode:string};items:Item[];rankedWins:number;level:number};
async function mine(){return rpc<Own>('get_my_cosmetics');}
async function equip(itemCode:string){return rpc<Own['loadout']>('equip_my_cosmetic',[itemCode]);}
const byCode=(result:Own,code:string)=>result.items.find(x=>x.code===code);

describe('Cosmetics V1: immutable unlocks, equip authorization and RLS',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
    await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"')");
    for(const path of ['202610280001_initial_schema.sql',
      '202610280006_ranked_queue_and_rating.sql',
      '202610290003_player_profile_discovery.sql',
      '202610290009_cosmetics_v1.sql'
    ])await db.exec(readFileSync(new URL('../supabase/migrations/'+path,import.meta.url),'utf8'));
  },30000);
  beforeEach(async()=>{
    await db.exec('reset role;');
    await db.exec('truncate public.player_cosmetic_loadouts,public.player_cosmetic_inventory,public.player_profile_settings;');
    await db.exec('update public.profiles set ranked_wins=0');
    await db.exec('update public.cosmetic_items set published=true');
    if((await db.query<{exists:boolean}>("select to_regclass('public.player_progress') is not null as exists")).rows[0].exists)
      await db.exec('drop table public.player_progress');
  },30000);
  afterAll(async()=>{await db?.close();});

  it('grants two permanent starters exactly once with correct slots and metadata',async()=>{
    await as(a);
    const first=await mine();
    expect(first).toMatchObject({loadout:{pieceCode:'piece-classic',avatarCode:'avatar-classic'},rankedWins:0,level:1});
    expect(first.items).toHaveLength(6);
    expect(first.items.filter(x=>x.owned).map(x=>x.code)).toEqual(['avatar-classic','piece-classic']);
    expect(first.items.filter(x=>x.equipped).map(x=>x.code)).toEqual(['avatar-classic','piece-classic']);
    expect(first.items.find(x=>x.code==='avatar-orbit')).toMatchObject({unlockKind:'xp_level',requiredValue:2,owned:false});
    expect((await mine()).items.filter(x=>x.owned)).toHaveLength(2);
    expect(await equip('piece-classic')).toEqual(first.loadout);
    await db.exec('reset role;');
    expect((await db.query<{count:string}>('select count(*)::text as count from public.player_cosmetic_inventory where user_id=$1',[a])).rows[0].count).toBe('2');
  },30000);

  it('rejects locked, invalid, unpublished and wrong-user equip requests',async()=>{
    await as(a);
    await mine();
    await expect(equip('piece-forest')).rejects.toThrow('COSMETIC_LOCKED');
    await expect(equip('piece-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).rejects.toThrow('INVALID_COSMETIC_ITEM');
    await expect(equip('piece-missing')).rejects.toThrow('COSMETIC_NOT_AVAILABLE');
    await expect(equip('avatar-classic;DROP TABLE')).rejects.toThrow('INVALID_COSMETIC_ITEM');
    await db.exec('reset role;');
    await db.exec("insert into public.cosmetic_items(code,slot,name,unlock_kind,required_value,published) values('piece-hidden','piece','Hidden','starter',0,false)");
    await as(a);
    await expect(equip('piece-hidden')).rejects.toThrow('COSMETIC_NOT_AVAILABLE');
    expect((await mine()).items.some(x=>x.code==='piece-hidden')).toBe(false);
    await as(b);
    expect((await mine()).loadout).toEqual({pieceCode:'piece-classic',avatarCode:'avatar-classic'});
    expect(await equip('avatar-classic')).toEqual({pieceCode:'piece-classic',avatarCode:'avatar-classic'});
    await db.exec('reset role;');
    await db.exec("delete from public.cosmetic_items where code='piece-hidden'");
  },30000);

  it('unlocks ranked milestones with trusted stats and retains ownership after stats change',async()=>{
    await as(a);
    await mine();
    await db.exec('reset role;');
    await db.query('update public.profiles set ranked_wins=3 where id=$1',[a]);
    await as(a);
    const unlocked=await mine();
    expect(unlocked.rankedWins).toBe(3);
    expect(byCode(unlocked,'piece-forest')?.owned).toBe(true);
    expect(byCode(unlocked,'avatar-bronze')?.owned).toBe(true);
    expect(await equip('piece-forest')).toEqual({pieceCode:'piece-forest',avatarCode:'avatar-classic'});
    expect(await equip('avatar-bronze')).toEqual({pieceCode:'piece-forest',avatarCode:'avatar-bronze'});
    await db.exec('reset role;');
    await db.query('update public.profiles set ranked_wins=0 where id=$1',[a]);
    await as(a);
    const later=await mine();
    expect(byCode(later,'piece-forest')?.owned).toBe(true);
    expect(later.loadout).toEqual({pieceCode:'piece-forest',avatarCode:'avatar-bronze'});
    await expect(db.query('update public.player_cosmetic_loadouts set piece_code=$1 where user_id=$2',['piece-classic',a]))
      .rejects.toThrow(/permission denied/);
  },30000);

  it('treats unmerged XP V1 as locked and later unlocks level-gated items without migration dependency',async()=>{
    await as(a);
    expect((await mine()).level).toBe(1);
    await expect(equip('avatar-orbit')).rejects.toThrow('COSMETIC_LOCKED');
    await db.exec('reset role;');
    // Simulate the authoritative player_progress surface supplied by XP V1.
    await db.exec('create table public.player_progress (user_id uuid primary key,total_xp bigint not null)');
    await db.query('insert into public.player_progress(user_id,total_xp) values($1,100)',[a]);
    await as(a);
    const atTwo=await mine();
    expect(atTwo.level).toBe(2);
    expect(byCode(atTwo,'avatar-orbit')?.owned).toBe(true);
    expect(byCode(atTwo,'piece-starlight')?.owned).toBe(false);
    expect(await equip('avatar-orbit')).toMatchObject({avatarCode:'avatar-orbit'});
    await db.exec('reset role;');
    await db.query('update public.player_progress set total_xp=400 where user_id=$1',[a]);
    await as(a);
    const atThree=await mine();
    expect(atThree.level).toBe(3);
    expect(byCode(atThree,'piece-starlight')?.owned).toBe(true);
    expect(await equip('piece-starlight')).toMatchObject({pieceCode:'piece-starlight',avatarCode:'avatar-orbit'});
    await db.exec('reset role;drop table public.player_progress;');
    await as(a);
    expect((await mine()).loadout).toEqual({pieceCode:'piece-starlight',avatarCode:'avatar-orbit'});
  },30000);

  it('hides unpublished equipped items from another player and from the owner response',async()=>{
    await db.exec('reset role;');
    await db.query('update public.profiles set ranked_wins=3 where id=$1',[a]);
    await as(a);
    await mine();
    await equip('piece-forest');
    await equip('avatar-bronze');
    await as(b);
    expect(await rpc('get_public_player_cosmetics',[a]))
      .toMatchObject({pieceCode:'piece-forest',avatarCode:'avatar-bronze'});

    // Simulate a moderator unpublishing both currently equipped items.
    await db.exec('reset role;');
    await db.exec("update public.cosmetic_items set published=false where code in ('piece-forest','avatar-bronze')");
    await as(b);
    expect(await rpc('get_public_player_cosmetics',[a]))
      .toEqual({userId:a,pieceCode:'piece-classic',avatarCode:'avatar-classic'});
    await as(a);
    const own=await mine();
    expect(own.loadout).toEqual({pieceCode:'piece-classic',avatarCode:'avatar-classic'});
    expect(own.items.some(x=>['piece-forest','avatar-bronze'].includes(x.code))).toBe(false);
    expect(own.items.filter(x=>x.equipped).map(x=>x.code))
      .toEqual(['avatar-classic','piece-classic']);
    await expect(equip('piece-forest')).rejects.toThrow('COSMETIC_NOT_AVAILABLE');
    expect(await equip('avatar-classic'))
      .toEqual({pieceCode:'piece-classic',avatarCode:'avatar-classic'});

    // Stored choices can return when published again without exposing them meanwhile.
    await db.exec('reset role;');
    const stored=(await db.query<{piece_code:string}>(
      'select piece_code from public.player_cosmetic_loadouts where user_id=$1',[a]
    )).rows[0];
    expect(stored.piece_code).toBe('piece-forest');
    await db.exec("update public.cosmetic_items set published=true where code in ('piece-forest','avatar-bronze')");
    await as(b);
    expect(await rpc('get_public_player_cosmetics',[a]))
      .toEqual({userId:a,pieceCode:'piece-forest',avatarCode:'avatar-classic'});
  },30000);

  it('restricts direct writes and cross-account inventories while allowing owner-only SELECT',async()=>{
    await as(a);
    await mine();
    await as(b);
    await mine();
    expect((await db.query('select * from public.player_cosmetic_inventory where user_id=$1',[a])).rows).toEqual([]);
    expect((await db.query('select * from public.player_cosmetic_loadouts where user_id=$1',[a])).rows).toEqual([]);
    await expect(db.query("insert into public.player_cosmetic_inventory(user_id,item_code) values($1,'piece-forest')",[b]))
      .rejects.toThrow(/permission denied/i);
    await expect(db.query('delete from public.player_cosmetic_inventory where user_id=$1',[b]))
      .rejects.toThrow(/permission denied/i);
    await expect(db.query('update public.profiles set ranked_wins=100 where id=$1',[b]))
      .rejects.toThrow(/permission denied/i);
    await db.exec('reset role;set role anon;');
    await expect(rpc('get_my_cosmetics')).rejects.toThrow(/permission denied/i);
    await expect(rpc('equip_my_cosmetic',['piece-classic'])).rejects.toThrow(/permission denied/i);
    await expect(rpc('get_public_player_cosmetics',[a])).rejects.toThrow(/permission denied/i);
    await expect(db.query('select * from public.cosmetic_items')).rejects.toThrow(/permission denied/i);
  },30000);

  it('guards slot ownership via composite FK even against a privileged malformed update',async()=>{
    await as(a);await mine();
    await db.exec('reset role;');
    await expect(db.query('update public.player_cosmetic_loadouts set piece_code=$1 where user_id=$2',['avatar-classic',a]))
      .rejects.toThrow(/foreign key/i);
    await expect(db.query('update public.player_cosmetic_loadouts set piece_code=$1 where user_id=$2',['piece-forest',a]))
      .rejects.toThrow(/foreign key/i);
    await expect(db.query("update public.player_cosmetic_loadouts set avatar_slot='piece' where user_id=$1",[a]))
      .rejects.toThrow(/check constraint/i);
  },30000);

  it('publishes only visible players equipped codes, including defaults before first visit',async()=>{
    await as(a);
    const defaultOther=await rpc<{userId:string;pieceCode:string;avatarCode:string}>('get_public_player_cosmetics',[b]);
    expect(defaultOther).toEqual({userId:b,pieceCode:'piece-classic',avatarCode:'avatar-classic'});
    await rpc('set_my_player_profile_settings',[false,false]);
    await as(b);
    expect(await rpc('get_public_player_cosmetics',[a])).toBeNull();
    await as(a);
    expect((await rpc<{userId:string}>('get_public_player_cosmetics',[a])).userId).toBe(a);
    await as(b);
    expect(await rpc('get_public_player_cosmetics',['99999999-9999-4999-8999-999999999999'])).toBeNull();
  },30000);
});