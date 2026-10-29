import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';

const a='00000000-0000-4000-8000-000000000011';
const b='11111111-1111-4111-8111-111111111112';
const c='22222222-2222-4222-8222-222222222223';
let db:PGlite;
async function as(id:string){
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function rpc<T=unknown>(name:string,args:unknown[]=[]) {
  return (await db.query<{result:T}>(
    'select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',args
  )).rows[0].result;
}
async function inviteAndAccept(){
  await as(a);
  const request=await rpc<{requestId:string}>('send_friend_request',[b]);
  await as(b);
  await rpc('respond_friend_request',[request.requestId,true]);
}
const uniqueRequest=(i:number)=>'77777777-7777-4777-8777-'+String(i).padStart(12,'0');
async function send(from:string,to:string,index:number,body='hello') {
  await as(from);
  return rpc<{id:string;threadId:string;senderId:string;body:string;alreadySent:boolean}>(
    'send_direct_message',[to,body,uniqueRequest(index)]
  );
}
async function page(peer:string,before:string|null=null,limit=30) {
  return rpc<{threadId:string|null;messages:{id:string;body:string;senderId:string}[];hasMore:boolean}>(
    'get_direct_messages',[peer,before,limit]
  );
}
async function inbox(){
  return rpc<{threadId:string;userId:string;nickname:string;unreadCount:number;lastMessage:{id:string}|null}[]>(
    'get_direct_message_inbox'
  );
}
describe('Direct Messages V1 SQL and privacy',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
    await db.exec("insert into auth.users(id) values ('"+a+"'),('"+b+"'),('"+c+"')");
    for(const f of [
      '202610280001_initial_schema.sql',
      '202610280006_ranked_queue_and_rating.sql',
      '202610280010_profile_nickname.sql',
      '202610290003_player_profile_discovery.sql',
      '202610290005_friends_v1.sql',
      '202610290006_direct_messages_v1.sql'
    ])await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
    await as(a);await rpc('set_my_nickname',['Alpha']);
    await as(b);await rpc('set_my_nickname',['Bravo']);
    await as(c);await rpc('set_my_nickname',['Charlie']);
  },30000);
  beforeEach(async()=>{
    await db.exec('reset role;truncate public.dm_messages,public.dm_read_state,public.dm_threads,public.friend_links,public.player_blocks cascade;');
  },30000);
  afterAll(async()=>{await db?.close();});

  it('denies anonymous RPC and nonfriend reads/writes with no threads created',async()=>{
    await as(a);
    await expect(send(a,b,1)).rejects.toThrow('DM_NOT_AVAILABLE');
    expect(await inbox()).toEqual([]);
    await expect(db.query("insert into public.dm_threads(user_low,user_high) values($1,$2)",[a,b]))
      .rejects.toThrow(/permission denied/i);
    await expect(db.query("insert into public.dm_messages(thread_id,sender_id,request_id,body) values(gen_random_uuid(),$1,$2,'hi')",[a,uniqueRequest(1)]))
      .rejects.toThrow(/permission denied/i);
    await db.exec('reset role;set role anon;');
    for(const name of ['get_direct_message_inbox','dm_friend_allowed']){
      await expect(rpc(name,name==='dm_friend_allowed'?[b]:[])).rejects.toThrow(/permission denied/i);
    }
  },30000);

  it('allows only accepted friends, reveals no data to third parties or blocked accounts',async()=>{
    await as(a);
    const req=await rpc<{requestId:string}>('send_friend_request',[b]);
    await expect(send(a,b,2)).rejects.toThrow('DM_NOT_AVAILABLE');
    await as(b);await rpc('respond_friend_request',[req.requestId,true]);
    const saved=await send(a,b,3,'  첫 메시지  ');
    expect(saved).toMatchObject({body:'첫 메시지',senderId:a,alreadySent:false});
    expect(saved.threadId).toMatch(/^[0-9a-f-]{36}$/i);
    await as(c);
    expect((await db.query('select * from public.dm_threads')).rows).toHaveLength(0);
    expect((await db.query('select * from public.dm_messages')).rows).toHaveLength(0);
    await expect(page(a)).rejects.toThrow('DM_NOT_AVAILABLE');
    await as(b);
    expect((await inbox())[0]).toMatchObject({userId:a,unreadCount:1,lastMessage:{id:saved.id}});
    expect((await page(a)).messages[0].body).toBe('첫 메시지');
    await rpc('set_player_block',[a,true]);
    await expect(page(a)).rejects.toThrow('DM_NOT_AVAILABLE');
    expect(await inbox()).toEqual([]);
    expect((await db.query('select * from public.dm_messages')).rows).toHaveLength(0);
    await as(a);
    await expect(send(a,b,4)).rejects.toThrow('DM_NOT_AVAILABLE');
  },30000);

  it('deduplicates a retry before the throttle and prevents same-second spam',async()=>{
    await inviteAndAccept();
    const x=await send(a,b,5,'Once');
    const retry=await send(a,b,5,'Different content');
    expect(retry).toMatchObject({id:x.id,body:'Once',alreadySent:true});
    await expect(send(a,b,6,'twice')).rejects.toThrow('DM_RATE_LIMIT');
    const other=await send(b,a,7,'from B');
    expect(other.senderId).toBe(b);
    await as(a);
    expect((await page(b)).messages).toHaveLength(2);
    const owner=(await db.query<{count:string}>(
      'select count(*)::text as count from public.dm_messages'
    )).rows[0].count;
    expect(owner).toBe('2');
  },30000);

  it('supports cursor pagination, unread counts and monotonic read receipts',async()=>{
    await inviteAndAccept();
    const ids:string[]=[];
    // Seed messages as database owner to avoid rate throttle; never expose write
    // grants to the client in production.
    await db.exec('reset role;');
    const t=(await db.query<{id:string}>(
      'insert into public.dm_threads(user_low,user_high) values($1,$2) returning id',[a,b]
    )).rows[0].id;
    for(let n=1;n<=5;n++){
      const who=n%2?a:b;
      const m=(await db.query<{id:string}>(
        'insert into public.dm_messages(thread_id,sender_id,request_id,body) values($1,$2,$3,$4) returning id::text as id',
        [t,who,uniqueRequest(n+30),'msg'+n]
      )).rows[0];ids.push(m.id);
    }
    await as(a);
    const first=await page(b,null,2);
    expect(first.messages.map(x=>x.body)).toEqual(['msg5','msg4']);
    expect(first.hasMore).toBe(true);
    const second=await page(b,first.messages[1].id,2);
    expect(second.messages.map(x=>x.body)).toEqual(['msg3','msg2']);
    expect(second.hasMore).toBe(true);
    const third=await page(b,second.messages[1].id,2);
    expect(third.messages.map(x=>x.body)).toEqual(['msg1']);
    expect(third.hasMore).toBe(false);
    expect((await inbox())[0].unreadCount).toBe(2);
    expect(await rpc('mark_direct_messages_read',[b,ids[3]]))
      .toMatchObject({lastReadId:ids[3]});
    expect((await inbox())[0].unreadCount).toBe(0);
    expect(await rpc('mark_direct_messages_read',[b,ids[0]]))
      .toMatchObject({lastReadId:ids[3]});
    await expect(rpc('mark_direct_messages_read',[b,99999999]))
      .rejects.toThrow('DM_INVALID_MESSAGE_ID');
    await expect(page(b,null,0)).rejects.toThrow('DM_INVALID_PAGE');
    await expect(page(b,'-2')).rejects.toThrow('DM_INVALID_PAGE');
  },30000);

  it('revokes access after friendship removal and restores when re-friended',async()=>{
    await inviteAndAccept();
    const saved=await send(a,b,65,'history');
    await as(b);expect((await page(a)).messages[0].id).toBe(saved.id);
    await rpc('remove_friend',[a]);
    expect((await db.query('select * from public.dm_messages')).rows).toHaveLength(0);
    await expect(page(a)).rejects.toThrow('DM_NOT_AVAILABLE');
    await as(a);await expect(page(b)).rejects.toThrow('DM_NOT_AVAILABLE');
    const next=await rpc<{requestId:string}>('send_friend_request',[b]);
    await as(b);await rpc('respond_friend_request',[next.requestId,true]);
    expect((await page(a)).messages[0].id).toBe(saved.id);
  },30000);
});