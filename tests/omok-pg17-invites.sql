\set ON_ERROR_STOP on
-- Standalone disposable PostgreSQL 17 fixture. Never connects to hosted Supabase.
create extension if not exists dblink;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $uid$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$uid$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create publication supabase_realtime;
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');

\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290005_friends_v1.sql
\i supabase/migrations/202611030001_omok_casual_core.sql
\i supabase/migrations/202611030002_omok_social_and_rematch.sql
\i supabase/migrations/202611030005_omok_friend_invites.sql

do $permissions$
begin
 if current_setting('server_version_num')::int not between 170000 and 179999 then
   raise exception 'Expected isolated PG17';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.omok_friend_invites'::regclass)
   or has_table_privilege('anon','public.omok_friend_invites','SELECT')
   or has_table_privilege('authenticated','public.omok_friend_invites','SELECT')
   or has_table_privilege('authenticated','public.omok_friend_invites','INSERT')
   or has_table_privilege('authenticated','public.omok_friend_invites','UPDATE')
   or has_function_privilege('anon','public.send_omok_friend_invite(uuid,uuid)','EXECUTE')
   or has_function_privilege('anon','public.respond_omok_friend_invite(uuid,boolean)','EXECUTE')
   or not has_function_privilege('authenticated','public.respond_omok_friend_invite(uuid,boolean)','EXECUTE') then
   raise exception 'Omok invite ACL/RLS regression';
 end if;
 raise notice 'PASS: PG17 migrations and invite ACL';
end;
$permissions$;

insert into public.friend_links(requester_id,recipient_id,status) values
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted');

set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_room('ABCDEFGH') as room_id \gset
select (public.send_omok_friend_invite(:'room_id'::uuid,'22222222-2222-4222-8222-222222222222'::uuid)->>'inviteId') as invitation \gset
select set_config('qa.invite_room', :'room_id', false);
select set_config('qa.invite_id', :'invitation', false);
do $retry$
declare answer jsonb;
begin
  answer:=public.send_omok_friend_invite(current_setting('qa.invite_room')::uuid,'22222222-2222-4222-8222-222222222222');
  if answer->>'inviteId' <> current_setting('qa.invite_id') or answer->>'alreadyPending'<>'true' then
    raise exception 'Duplicate send created another invite';
  end if;
end;
$retry$;
reset role;

set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $outsider$
declare blocked boolean:=false;
begin
 if public.list_omok_received_invites()<>'[]'::jsonb then
   raise exception 'Outsider sees private invitation'; end if;
 begin
   perform public.respond_omok_friend_invite(current_setting('qa.invite_id')::uuid,true);
 exception when others then blocked:=true; end;
 if not blocked then raise exception 'Outsider accepted invitation'; end if;
end;
$outsider$;
reset role;

set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $inbox$
begin
 if jsonb_array_length(public.list_omok_received_invites())<>1 then
   raise exception 'Recipient inbox missing invitation'; end if;
end;
$inbox$;
reset role;

-- Deliberately exercise two real PostgreSQL connections. Guest acceptance locks
-- the room; a third-user code join must wait and then fail without occupying seat 2.
create function public.verify_omok_invite_pg17_race(p_room uuid,p_invite uuid)
returns void language plpgsql as $race$
declare
 connection text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 guest text:='22222222-2222-4222-8222-222222222222';
 outsider text:='33333333-3333-4333-8333-333333333333';
 guest_result text; waiting boolean:=false; worker_pid int; i int;
begin
 perform dblink_connect('invite_guest',connection);
 perform dblink_connect('invite_third',connection);
 perform dblink_exec('invite_guest','begin');
 perform dblink_exec('invite_guest','set local role authenticated');
 perform dblink_exec('invite_guest',format('set local request.jwt.claim.sub=%L',guest));
 select result into guest_result from dblink('invite_guest',
   format('select public.respond_omok_friend_invite(%L::uuid,true)::text',p_invite))
   as t(result text);
 if guest_result not like '%"accepted"%' then
   raise exception 'Invitation was not accepted: %',guest_result; end if;

 perform dblink_exec('invite_third','begin');
 perform dblink_exec('invite_third','set local role authenticated');
 perform dblink_exec('invite_third',format('set local request.jwt.claim.sub=%L',outsider));
 perform dblink_exec('invite_third','set local statement_timeout=8000');
 select pid into worker_pid from dblink('invite_third','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('invite_third',
   'select public.join_omok_room(''ABCDEFGH'')::text');
 for i in 1..120 loop
   select exists(select 1 from pg_stat_activity
     where pid=worker_pid and wait_event_type='Lock') into waiting;
   exit when waiting;
   perform pg_sleep(0.025);
 end loop;
 if not waiting then raise exception 'Parallel join did not serialize on room'; end if;
 perform dblink_exec('invite_guest','commit');
 perform result from dblink_get_result('invite_third',false) as t(result text);
 if dblink_error_message('invite_third') not like '%ROOM_FULL%'
    and dblink_error_message('invite_third') not like '%ROOM_UNAVAILABLE%' then
   raise exception 'Third join was not rejected: %',dblink_error_message('invite_third');
 end if;
 perform dblink_exec('invite_third','rollback');
 if (select count(*) from public.omok_room_players where room_id=p_room and seat=2)<>1
    or not exists(select 1 from public.omok_room_players
      where room_id=p_room and seat=2 and user_id=guest::uuid)
    or (select status from public.omok_friend_invites where id=p_invite)<>'accepted'
 then raise exception 'Concurrent accept/join corrupted room capacity'; end if;
 perform dblink_disconnect('invite_guest');
 perform dblink_disconnect('invite_third');
 raise notice 'PASS: invitation accepted once and racing direct join was rejected';
end;
$race$;
select public.verify_omok_invite_pg17_race(:'room_id'::uuid,:'invitation'::uuid);

-- Invalidate pending invitations when either account blocks the other.
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_room('ABCD2345') as blocked_room \gset
select (public.send_omok_friend_invite(:'blocked_room'::uuid,'22222222-2222-4222-8222-222222222222'::uuid)->>'inviteId') as blocked_invite \gset
select set_config('qa.blocked_invite_id', :'blocked_invite', false);
reset role;
insert into public.player_blocks(blocker_id,blocked_id) values
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $blocked$
declare rejected boolean:=false;
begin
 if public.list_omok_received_invites()<>'[]'::jsonb then
   raise exception 'Blocked host remains in inbox'; end if;
 begin perform public.respond_omok_friend_invite(current_setting('qa.blocked_invite_id')::uuid,true);
 exception when others then rejected:=true; end;
 if not rejected then raise exception 'Blocked invitation was accepted'; end if;
end;
$blocked$;
reset role;

select 'PASS: Omok PG17 friend invitations, ACL, direct joins, and block rules' as result;
