\set ON_ERROR_STOP on
-- Isolated PostgreSQL 16 only. This test never connects to hosted Supabase.
create extension dblink;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create publication supabase_realtime;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');

\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610280002_casual_rooms.sql
\i supabase/migrations/202610280003_casual_game.sql
\i supabase/migrations/202610280006_ranked_queue_and_rating.sql
\i supabase/migrations/202610280010_profile_nickname.sql
\i supabase/migrations/202610290002_ai_rooms.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290005_friends_v1.sql
\i supabase/migrations/202610290007_room_friend_invites_v1.sql

-- Committed fixtures are visible to both independent test connections.
insert into public.friend_links(requester_id,recipient_id,status)
values('11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222','accepted');
insert into public.rooms(code,owner_id)
values('ABCDEFGH','11111111-1111-4111-8111-111111111111'),
      ('ABCDEFGJ','11111111-1111-4111-8111-111111111111');
insert into public.room_players(room_id,user_id,seat)
select id,owner_id,1 from public.rooms where code in ('ABCDEFGH','ABCDEFGJ');
insert into public.room_friend_invites(room_id,inviter_id,invitee_id)
select id,'11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222'
from public.rooms where code='ABCDEFGH';

-- Catch expected business rejections without aborting the test connection.
create function public.test_invite_race_join(p_code text) returns text
language plpgsql security invoker set search_path='' as $$
declare v_room uuid;
begin
  v_room:=public.join_casual_room(p_code);
  return 'OK:' || v_room::text;
exception when others then
  return 'ERROR:' || SQLSTATE || ':' || SQLERRM;
end;
$$;
create function public.test_invite_race_accept(p_id uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
  v_result:=public.respond_room_friend_invite(p_id,true);
  return 'OK:' || (v_result->>'inviteId');
exception when others then
  return 'ERROR:' || SQLSTATE || ':' || SQLERRM;
end;
$$;
create function public.test_invite_race_send(p_room uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
  v_result:=public.send_room_friend_invite(
    p_room,'22222222-2222-4222-8222-222222222222');
  return 'OK:' || (v_result->>'inviteId');
exception when others then
  return 'ERROR:' || SQLSTATE || ':' || SQLERRM;
end;
$$;
revoke all on function public.test_invite_race_join(text),
  public.test_invite_race_accept(uuid),public.test_invite_race_send(uuid)
  from public,anon;
grant execute on function public.test_invite_race_join(text),
  public.test_invite_race_accept(uuid),public.test_invite_race_send(uuid)
  to authenticated;

create function public.verify_invite_lock_order(p_code text,p_operation text)
returns void language plpgsql as $$
declare
  v_conn text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
  v_host text:='11111111-1111-4111-8111-111111111111';
  v_guest text:='22222222-2222-4222-8222-222222222222';
  v_room uuid;
  v_invite uuid;
  v_wait_pid int;
  v_waiting boolean:=false;
  v_join_result text;
  v_invite_result text;
  v_sql text;
  v_count int;
  v_pending int;
begin
  select id into strict v_room from public.rooms where code=p_code;
  if p_operation='accept' then
    select id into strict v_invite from public.room_friend_invites
      where room_id=v_room and invitee_id=v_guest::uuid;
    v_sql:=format('select public.test_invite_race_accept(%L::uuid)',v_invite);
  elsif p_operation='send' then
    v_sql:=format('select public.test_invite_race_send(%L::uuid)',v_room);
  else
    raise exception 'Unknown race operation %',p_operation;
  end if;

  perform dblink_connect('code_join',v_conn);
  perform dblink_connect('invite_operation',v_conn);

  -- Code-entry owns the room row before the competing invite RPC arrives.
  perform dblink_exec('code_join','begin');
  perform dblink_exec('code_join','set local statement_timeout = 4000');
  perform dblink_exec('code_join',
    format('set local request.jwt.claim.sub = %L',v_guest));
  perform id from dblink('code_join',
    format('select id from public.rooms where id=%L::uuid for update',v_room))
    as t(id uuid);

  perform dblink_exec('invite_operation','begin');
  perform dblink_exec('invite_operation','set local statement_timeout = 4000');
  perform dblink_exec('invite_operation',
    format('set local request.jwt.claim.sub = %L',
      case when p_operation='send' then v_host else v_guest end));
  select pid into v_wait_pid from dblink('invite_operation',
    'select pg_backend_pid()') as t(pid int);
  perform dblink_send_query('invite_operation',v_sql);
  for i in 1..100 loop
    select exists(select 1 from pg_stat_activity
      where pid=v_wait_pid and wait_event_type='Lock') into v_waiting;
    exit when v_waiting;
    perform pg_sleep(0.025);
  end loop;
  if not v_waiting then
    raise exception '%: invite RPC never waited for held room row',p_operation;
  end if;

  -- The old FOR UPDATE profile lock caused this INSERT's FK KEY SHARE
  -- to wait on the invite session, completing a deadlock cycle.
  select result into v_join_result from dblink('code_join',
    format('select public.test_invite_race_join(%L)',p_code))
    as t(result text);
  if v_join_result not like 'OK:%' then
    raise exception '%: code entry blocked/deadlocked: %',
      p_operation,v_join_result;
  end if;
  perform dblink_exec('code_join','commit');

  select result into v_invite_result from dblink_get_result('invite_operation')
    as t(result text);
  -- Drain asynchronous command results before issuing another command.
  perform result from dblink_get_result('invite_operation') as t(result text);
  perform dblink_exec('invite_operation','commit');
  if v_invite_result not like 'ERROR:%:ROOM_NOT_AVAILABLE' then
    raise exception '%: expected room occupied domain error, got %',
      p_operation,v_invite_result;
  end if;

  select count(*) into v_count from public.room_players
    where room_id=v_room and seat=2 and user_id=v_guest::uuid;
  if v_count<>1 or (select count(*) from public.room_players
      where room_id=v_room)<>2 then
    raise exception '%: room has duplicate/missing participants',p_operation;
  end if;
  select count(*) into v_pending from public.room_friend_invites
    where room_id=v_room;
  if v_pending <> (case when p_operation='accept' then 1 else 0 end) then
    raise exception '%: failed RPC left an unexpected invite row: %',
      p_operation,v_pending;
  end if;
  perform dblink_disconnect('invite_operation');
  perform dblink_disconnect('code_join');
  raise notice 'PASS: % against code entry: lock waited, no deadlock, one seat, no partial invite',p_operation;
end;
$$;

select public.verify_invite_lock_order('ABCDEFGH','accept');
select public.verify_invite_lock_order('ABCDEFGJ','send');

-- The weaker profile lock must still serialize with block/unfriend's
-- stronger FOR UPDATE, even though it allows FK KEY SHARE to proceed.
create function public.verify_friend_lock_conflict() returns void
language plpgsql as $$
declare
  v_conn text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
  v_wait_pid int;
  v_waiting boolean:=false;
  v_result text;
begin
  perform dblink_connect('invite_profile',v_conn);
  perform dblink_connect('friend_mutation',v_conn);
  perform dblink_exec('invite_profile','begin');
  perform id from dblink('invite_profile',
    'select id from public.profiles where id in (''11111111-1111-4111-8111-111111111111'', ''22222222-2222-4222-8222-222222222222'') order by id for no key update')
    as t(id uuid);
  perform dblink_exec('friend_mutation','begin');
  perform dblink_exec('friend_mutation',
    'set local request.jwt.claim.sub = ''22222222-2222-4222-8222-222222222222''');
  select pid into v_wait_pid from dblink('friend_mutation',
    'select pg_backend_pid()') as t(pid int);
  perform dblink_send_query('friend_mutation',
    'select public.set_player_block(''11111111-1111-4111-8111-111111111111''::uuid,true)::text');
  for i in 1..100 loop
    select exists(select 1 from pg_stat_activity
      where pid=v_wait_pid and wait_event_type='Lock') into v_waiting;
    exit when v_waiting;
    perform pg_sleep(0.025);
  end loop;
  if not v_waiting then
    raise exception 'Friend block did not wait for NO KEY UPDATE profile lock';
  end if;
  perform dblink_exec('invite_profile','commit');
  select result into v_result from dblink_get_result('friend_mutation')
    as t(result text);
  perform result from dblink_get_result('friend_mutation') as t(result text);
  perform dblink_exec('friend_mutation','commit');
  if v_result not like '%"blocked": true%' then
    raise exception 'Friend block did not complete after profile release: %',v_result;
  end if;
  if not exists(select 1 from public.player_blocks
    where blocker_id='22222222-2222-4222-8222-222222222222'
      and blocked_id='11111111-1111-4111-8111-111111111111') then
    raise exception 'Friend block missing after commit';
  end if;
  perform dblink_disconnect('friend_mutation');
  perform dblink_disconnect('invite_profile');
  raise notice 'PASS: NO KEY UPDATE still conflicts with Friends V1 FOR UPDATE';
end;
$$;
select public.verify_friend_lock_conflict();
