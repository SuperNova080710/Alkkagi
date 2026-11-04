import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';

const host='11111111-1111-4111-8111-111111111111';
const guest='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
let db:PGlite;
const q=(v:string)=>"'" + v + "'";
async function as(id:string){await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub',"+q(id)+",false)");}
async function rpc<T>(name:string,args=''):Promise<T>{
  return (await db.query<Record<string,T>>('select public.'+name+'('+args+')')).rows[0][name];
}
describe('Omok accepted-friend room invitations',()=>{
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
      insert into auth.users(id) values ('${host}'),('${guest}'),('${outsider}');
    `);
    for(const file of ['202610280001_initial_schema.sql','202611030001_omok_casual_core.sql'])
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    // Scoped Friends V1 fixtures for this migration test; full suite replays real 005.
    await db.exec(`
      create table public.friend_links(requester_id uuid,recipient_id uuid,status text);
      create table public.player_blocks(blocker_id uuid,blocked_id uuid);
      insert into public.friend_links values ('${host}','${guest}','accepted');
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/202611030005_omok_friend_invites.sql',import.meta.url),'utf8'));
  },30000);
  afterAll(async()=>{await db?.close();});

  it('limits invite table writes and hides pending invitations from outsiders',async()=>{
    await as(host);
    const acl=await db.query<{can_write:boolean}>(
      "select has_table_privilege('authenticated','public.omok_friend_invites','INSERT,UPDATE,DELETE') as can_write"
    );
    expect(acl.rows[0].can_write).toBe(false);
    await expect(db.query("update public.omok_friend_invites set status='accepted'"))
      .rejects.toThrow(/permission denied/);
    await as(outsider);
    expect(await rpc<unknown[]>('list_omok_received_invites')).toEqual([]);
  });

  it('sends one accepted-friend invitation, allows exact duplicate, and rejects nonfriends',async()=>{
    await as(host);
    const room=await rpc<string>('create_omok_room',q('ABCD2345'));
    const args=q(room)+','+q(guest);
    const first=await rpc<{inviteId:string;alreadyPending:boolean}>('send_omok_friend_invite',args);
    expect(first.alreadyPending).toBe(false);
    const retry=await rpc<{inviteId:string;alreadyPending:boolean}>('send_omok_friend_invite',args);
    expect(retry).toEqual({inviteId:first.inviteId,status:'pending',alreadyPending:true});
    await expect(rpc('send_omok_friend_invite',q(room)+','+q(outsider)))
      .rejects.toThrow('FRIEND_NOT_AVAILABLE');
    await as(guest);
    const inbox=await rpc<{id:string;roomId:string}[]>('list_omok_received_invites');
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({id:first.inviteId,roomId:room});
    const declined=await rpc<{status:string}>('respond_omok_friend_invite',q(first.inviteId)+',false');
    expect(declined.status).toBe('declined');
    await as(host);
    await expect(rpc('send_omok_friend_invite',args)).rejects.toThrow('ROOM_INVITE_ALREADY_SENT');
  });

  it('invalidates blocked invites and then accepts the second room atomically',async()=>{
    await as(host);
    const room=await rpc<string>('create_omok_room',q('ABCD2346'));
    const invite=await rpc<{inviteId:string}>('send_omok_friend_invite',q(room)+','+q(guest));
    await db.exec("reset role;insert into public.player_blocks values ("+q(guest)+","+q(host)+")");
    await as(guest);
    expect(await rpc<unknown[]>('list_omok_received_invites')).toEqual([]);
    await expect(rpc('respond_omok_friend_invite',q(invite.inviteId)+',true'))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
    await db.exec("reset role;delete from public.player_blocks where blocker_id="+q(guest));
    await as(guest);
    const accepted=await rpc<{status:string;roomId:string}>('respond_omok_friend_invite',
      q(invite.inviteId)+',true');
    expect(accepted).toEqual({inviteId:invite.inviteId,status:'accepted',roomId:room});
    const info=await rpc<{players:{seat:number}[]}>('get_omok_room',q(room));
    expect(info.players).toHaveLength(2);
    await expect(rpc('respond_omok_friend_invite',q(invite.inviteId)+',true'))
      .rejects.toThrow('ROOM_INVITE_NOT_FOUND');
  });
});
