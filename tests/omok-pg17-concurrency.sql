\set ON_ERROR_STOP on
-- Execute only against the disposable PostgreSQL 17 GitHub Actions container.
-- No hosted Supabase credentials or network endpoints are loaded.
create extension dblink;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $authuid$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$authuid$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create publication supabase_realtime;

insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202611030001_omok_casual_core.sql

do $acl$
declare tab text;
begin
 if current_setting('server_version_num')::integer<170000
    or current_setting('server_version_num')::integer>=180000 then
   raise exception 'Expected isolated PostgreSQL 17';
 end if;
 foreach tab in array array['omok_rooms','omok_room_players','omok_matches','omok_moves'] loop
   if not (select relrowsecurity from pg_class
       where oid=('public.'||tab)::regclass) then
     raise exception 'RLS disabled: %',tab;
   end if;
   if has_table_privilege('anon','public.'||tab,'SELECT') or
      has_table_privilege('authenticated','public.'||tab,'INSERT') or
      has_table_privilege('authenticated','public.'||tab,'UPDATE') or
      has_table_privilege('authenticated','public.'||tab,'DELETE') then
     raise exception 'Direct SQL privilege leak: %',tab;
   end if;
 end loop;
 if has_function_privilege('anon',
     'public.play_omok_move(uuid,uuid,integer,integer,integer)','EXECUTE') or
    not has_function_privilege('authenticated',
     'public.play_omok_move(uuid,uuid,integer,integer,integer)','EXECUTE') then
   raise exception 'Omok RPC authorization grants incorrect';
 end if;
 if (select count(*) from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
      and tablename in ('omok_rooms','omok_matches','omok_moves'))<>3 then
   raise exception 'Realtime publication is incomplete';
 end if;
 raise notice 'PASS: PostgreSQL 17 schema, RLS, table and RPC ACL, Realtime publication';
end;
$acl$;

-- Real authenticated roles and JWT context, not simulated client assertions.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.create_omok_room('ABCDEFGH') as qa_room \gset
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select public.join_omok_room('ABCDEFGH');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.start_omok_match(:'qa_room'::uuid) as qa_match \gset
reset role;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $outsider$
declare result_size integer; rejected boolean:=false;
begin
 select count(*) into result_size from public.omok_rooms;
 if result_size<>0 or exists(select 1 from public.omok_matches)
   or exists(select 1 from public.omok_moves) then
   raise exception 'Nonmember read leaked Omok data';
 end if;
 begin
   perform public.play_omok_move(
     (select id from public.omok_matches limit 1),
     'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,0,0);
 exception when others then rejected:=true; end;
 if not rejected then raise exception 'Nonmember write accepted'; end if;
end;
$outsider$;
reset role;

create function public.verify_omok_pg17_concurrency(p_match uuid)
returns void language plpgsql as $race$
declare
  conn text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
  alice text:='11111111-1111-4111-8111-111111111111';
  request_id uuid:='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
  first_result text;
  second_result text;
  lock_pid integer;
  waiting boolean:=false;
  i integer;
begin
  perform dblink_connect('omok_first',conn);
  perform dblink_connect('omok_retry',conn);
  perform dblink_exec('omok_first','begin');
  perform dblink_exec('omok_first','set local role authenticated');
  perform dblink_exec('omok_first',format('set local request.jwt.claim.sub = %L',alice));
  perform dblink_exec('omok_first','set local statement_timeout = 9000');
  select result into first_result from dblink('omok_first',
     format('select public.play_omok_move(%L::uuid,%L::uuid,1,0,0)::text',p_match,request_id))
    as t(result text);
  if first_result not like '%"replayed": false%' then
    raise exception 'Initial move was not committed to first transaction: %',first_result;
  end if;

  perform dblink_exec('omok_retry','begin');
  perform dblink_exec('omok_retry','set local role authenticated');
  perform dblink_exec('omok_retry',format('set local request.jwt.claim.sub = %L',alice));
  perform dblink_exec('omok_retry','set local statement_timeout = 9000');
  select pid into lock_pid from dblink('omok_retry','select pg_backend_pid()') as t(pid integer);
  perform dblink_send_query('omok_retry',
    format('select public.play_omok_move(%L::uuid,%L::uuid,1,0,0)::text',p_match,request_id));
  for i in 1..120 loop
    select exists(select 1 from pg_stat_activity
      where pid=lock_pid and wait_event_type='Lock') into waiting;
    exit when waiting;
    perform pg_sleep(0.025);
  end loop;
  if not waiting then raise exception 'Concurrent move did not block on match lock'; end if;

  perform dblink_exec('omok_first','commit');
  select result into second_result from dblink_get_result('omok_retry') as t(result text);
  perform result from dblink_get_result('omok_retry') as t(result text);
  if second_result not like '%"replayed": true%' then
     raise exception 'Retry was not idempotent: %',second_result;
  end if;
  perform dblink_exec('omok_retry','commit');
  if (select count(*) from public.omok_moves where match_id=p_match)<>1
     or (select turn_no from public.omok_matches where id=p_match)<>2
     or (select board_state #>> array['0','0'] from public.omok_matches where id=p_match)<>'black'
  then raise exception 'Concurrent retry created duplicate turn or board mutation'; end if;
  perform dblink_disconnect('omok_first');
  perform dblink_disconnect('omok_retry');
  raise notice 'PASS: two authenticated sessions contended on match row, exact retry replayed once';
end;
$race$;

select public.verify_omok_pg17_concurrency(:'qa_match'::uuid);

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select public.forfeit_omok_match(:'qa_match'::uuid);
reset role;

do $terminal$
declare final_match uuid;
declare final_room uuid;
begin
  select id into strict final_room from public.omok_rooms where code='ABCDEFGH';
  select id into strict final_match from public.omok_matches where room_id=final_room;
  if (select status from public.omok_matches where id=final_match)<>'finished' or
     (select finish_reason from public.omok_matches where id=final_match)<>'forfeit' or
     (select status from public.omok_rooms where id=final_room)<>'playing' then
    raise exception 'Core terminal match/room state violates same-room rematch contract';
  end if;
  raise notice 'PASS: finished game history retained; room playing for 002 rematch votes';
end;
$terminal$;
