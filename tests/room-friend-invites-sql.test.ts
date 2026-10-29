import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';

const host='11111111-1111-4111-8111-111111111111';
const guest='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const newCode=(n:number)=>'ABCDEFG'+('HJKLMNPQRSTUVWXYZ23456789'[n]);
let db:PGlite;
async function as(id:string){
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
}
async function rpc<T=unknown>(name:string,args:unknown[]=[]){
  const values=args.map((_,n)=>'$'+(n+1)).join(',');
  return (await db.query<{result:T}>('select public.'+name+'('+values+') as result',args)).rows[0].result;
}
async function room(n:number){
  await as(host);
  return rpc<string>('create_casual_room',[newCode(n)]);
}
async function friends(a:string,b:string){
  await as(a);
  const sent=await rpc<{requestId:string}>('send_friend_request',[b]);
  await as(b);
  await rpc('respond_friend_request',[sent.requestId,true]);
}
async function send(roomId:string,target=guest) {
  await as(host);
  return rpc<{inviteId:string;status:string;alreadyPending:boolean;expiresAt:string}>(
    'send_room_friend_invite',[roomId,target]
  );
}
async function received(){
  return rpc<{id:string;roomId:string;inviterId:string;inviterNickname:string}[]>(
    'list_received_room_invites'
  );
}
describe('Room friend invites V1: SQL permissions and concurrency invariants',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;");
    await db.exec("insert into auth.users(id) values ('"+host+"'),('"+guest+"'),('"+other+"')");
    for(const file of [
      '202610280001_initial_schema.sql',
      '202610280002_casual_rooms.sql',
      '202610280003_casual_game.sql',
      '202610280006_ranked_queue_and_rating.sql',
      '202610280010_profile_nickname.sql',
      '202610290002_ai_rooms.sql',
      '202610290003_player_profile_discovery.sql',
      '202610290005_friends_v1.sql',
      '202610290007_room_friend_invites_v1.sql'
    ]) await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    await as(host);await rpc('set_my_nickname',['HostAlpha']);
    await as(guest);await rpc('set_my_nickname',['GuestBravo']);
    await as(other);await rpc('set_my_nickname',['OtherGamma']);
  },30000);
  beforeEach(async()=>{
    await db.exec('reset role;truncate public.room_friend_invites,public.ai_turns,public.ai_matches,public.shots,public.matches,public.room_players,public.rooms,public.friend_links,public.player_blocks restart identity cascade;');
  },30000);
  afterAll(async()=>{await db?.close();});

  it('rejects nonfriends, self/stranger send, anonymous execute and direct table read/write',async()=>{
    const id=await room(0);
    await as(host);
    await expect(rpc('send_room_friend_invite',[id,guest])).rejects.toThrow('FRIEND_NOT_AVAILABLE');
    await expect(rpc('send_room_friend_invite',[id,host])).rejects.toThrow('INVALID_ROOM_INVITE');
    await expect(db.query('select * from public.room_friend_invites')).rejects.toThrow(/permission denied/i);
    await expect(db.query(
      'insert into public.room_friend_invites(room_id,inviter_id,invitee_id) values ($1,$2,$3)',
      [id,host,guest]
    )).rejects.toThrow(/permission denied/i);
    await as(other);
    await expect(rpc('send_room_friend_invite',[id,guest])).rejects.toThrow('ROOM_NOT_AVAILABLE');
    await db.exec('reset role;set role anon;');
    for(const name of ['list_received_room_invites','send_room_friend_invite']){
      await expect(rpc(name,name==='send_room_friend_invite'?[id,guest]:[]))
        .rejects.toThrow(/permission denied/i);
    }
  },30000);

  it('lets the host send one idempotent invite and the invited friend accept seat 2 atomically',async()=>{
    await friends(host,guest);
    const id=await room(1);
    const invite=await send(id);
    expect(invite).toMatchObject({status:'pending',alreadyPending:false});
    expect(await send(id)).toMatchObject({inviteId:invite.inviteId,alreadyPending:true});
    await as(other);
    expect(await received()).toEqual([]);
    await expect(rpc('respond_room_friend_invite',[invite.inviteId,true]))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
    await expect(rpc('list_sent_room_invites',[id])).rejects.toThrow('ROOM_NOT_AVAILABLE');
    await as(guest);
    expect((await received()).map(x=>x.id)).toEqual([invite.inviteId]);
    const accepted=await rpc<{status:string;roomId:string}>('respond_room_friend_invite',[invite.inviteId,true]);
    expect(accepted).toEqual({inviteId:invite.inviteId,status:'accepted',roomId:id});
    const joined=await rpc<string>('get_casual_room',[id]);
    expect(joined).toBeTruthy();
    await expect(rpc('respond_room_friend_invite',[invite.inviteId,true]))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
    await as(host);
    const sent=await rpc<{id:string;status:string}[]>('list_sent_room_invites',[id]);
    expect(sent[0]).toMatchObject({id:invite.inviteId,status:'accepted'});
    const seats=(await db.query<{seat:number}>( // RLS sees only host seat
      'select seat from public.room_players where room_id=$1',[id]
    )).rows;
    expect(seats.map(x=>x.seat)).toEqual([1]);
    await db.exec('reset role;');
    const total=(await db.query<{count:string}>(
      'select count(*)::text as count from public.room_players where room_id=$1',[id]
    )).rows[0].count;
    expect(total).toBe('2');
  },30000);

  it('honors decline, timeout, room closure and existing occupant races',async()=>{
    await friends(host,guest);
    const id=await room(2);
    const invite=await send(id);
    await as(guest);
    const declined=await rpc<{status:string;roomId:null}>('respond_room_friend_invite',[invite.inviteId,false]);
    expect(declined).toMatchObject({status:'declined',roomId:null});
    expect(await received()).toEqual([]);
    await as(host);
    await expect(rpc('send_room_friend_invite',[id,guest]))
      .rejects.toThrow('ROOM_INVITE_ALREADY_SENT');

    const nextId=await room(3);
    const next=await send(nextId);
    await db.exec('reset role;');
    await db.query("update public.room_friend_invites set created_at=now()-interval '10 minutes', expires_at=now()-interval '1 minute' where id=$1",[next.inviteId]);
    await as(guest);
    expect(await received()).toEqual([]);
    await expect(rpc('respond_room_friend_invite',[next.inviteId,true]))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');

    const occupiedRoom=await room(4);
    const occupiedInvite=await send(occupiedRoom);
    await as(other);
    await rpc('join_casual_room',[newCode(4)]);
    await as(guest);
    expect(await received()).toEqual([]);
    await expect(rpc('respond_room_friend_invite',[occupiedInvite.inviteId,true]))
      .rejects.toThrow('ROOM_NOT_AVAILABLE');
    await as(host);
    await expect(rpc('send_room_friend_invite',[occupiedRoom,guest]))
      .rejects.toThrow('ROOM_NOT_AVAILABLE');

    const closed=await room(5);
    const closedInvite=await send(closed);
    await as(host);
    await rpc('leave_casual_room',[closed]);
    await as(guest);
    expect(await received()).toEqual([]);
    await expect(rpc('respond_room_friend_invite',[closedInvite.inviteId,true]))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
  },30000);

  it('blocks stale invitations after friendship deletion or bilateral blocking',async()=>{
    await friends(host,guest);
    const id=await room(6);
    const invite=await send(id);
    await as(guest);
    await rpc('set_player_block',[host,true]);
    expect(await received()).toEqual([]);
    await expect(rpc('respond_room_friend_invite',[invite.inviteId,true]))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
    await as(host);
    await expect(rpc('send_room_friend_invite',[id,guest]))
      .rejects.toThrow('FRIEND_NOT_AVAILABLE');

    await as(guest);await rpc('set_player_block',[host,false]);
    await friends(host,guest);
    const fresh=await room(7);
    const freshInvite=await send(fresh);
    await as(host);
    await rpc('remove_friend',[guest]);
    await as(guest);
    expect(await received()).toEqual([]);
    await expect(rpc('respond_room_friend_invite',[freshInvite.inviteId,true]))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
  },30000);

  it('rejects AI-started rooms and preserves owner-only send while protecting rank data',async()=>{
    await friends(host,guest);
    const id=await room(8);
    await as(other);
    await expect(rpc('send_room_friend_invite',[id,guest]))
      .rejects.toThrow('ROOM_NOT_AVAILABLE');
    await as(host);
    await rpc('start_ai_room',[id,'easy']);
    await expect(rpc('send_room_friend_invite',[id,guest]))
      .rejects.toThrow('ROOM_NOT_AVAILABLE');
    await expect(db.query('update public.profiles set rating=9999 where id=$1',[host]))
      .rejects.toThrow(/permission denied/i);
    const rating=(await db.query<{rating:number}>(
      'select rating from public.profiles where id=$1',[host]
    )).rows[0].rating;
    expect(rating).toBe(1000);
  },30000);
});