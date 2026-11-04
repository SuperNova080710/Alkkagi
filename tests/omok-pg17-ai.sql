\set ON_ERROR_STOP on
-- Isolated PostgreSQL 17, no hosted Supabase access or secret keys.
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
 ('22222222-2222-4222-8222-222222222222');
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202611030001_omok_casual_core.sql
\i supabase/migrations/202611030002_omok_social_and_rematch.sql
\i supabase/migrations/202611030003_omok_ai_matches.sql

do $acl$
begin
 if current_setting('server_version_num')::int not between 170000 and 179999
   or not (select relrowsecurity from pg_class where oid='public.omok_ai_matches'::regclass)
   or not (select relrowsecurity from pg_class where oid='public.omok_ai_turns'::regclass)
   or has_table_privilege('anon','public.omok_ai_matches','SELECT')
   or has_table_privilege('authenticated','public.omok_ai_matches','UPDATE')
   or has_table_privilege('authenticated','public.omok_ai_turns','INSERT')
   or has_function_privilege('anon',
      'public.commit_omok_ai_turn(uuid,uuid,uuid,integer,jsonb,integer,integer,integer,integer)','EXECUTE')
   or has_function_privilege('authenticated',
      'public.commit_omok_ai_turn(uuid,uuid,uuid,integer,jsonb,integer,integer,integer,integer)','EXECUTE')
   or not has_function_privilege('service_role',
      'public.commit_omok_ai_turn(uuid,uuid,uuid,integer,jsonb,integer,integer,integer,integer)','EXECUTE')
   or has_function_privilege('authenticated','public.forfeit_omok_ai_match(uuid,uuid)','EXECUTE')
   or (select count(*) from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename='omok_ai_matches')<>1
 then raise exception 'PG17 AI SQL migration/privilege/realtime regression'; end if;
 raise notice 'PASS: PG17 AI migrations, RLS, and service-only RPCs';
end;
$acl$;

set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_ai_match('hard') as match_id \gset
reset role;
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $privacy$
begin
 if exists(select 1 from public.omok_ai_matches)
   or exists(select 1 from public.omok_ai_turns) then
   raise exception 'Other user may read AI game'; end if;
end;
$privacy$;
reset role;
set role service_role;
select set_config('qa.ai_match', :'match_id', false);
do $ownership$
declare blocked boolean:=false;
begin
 begin
   perform public.forfeit_omok_ai_match(
     current_setting('qa.ai_match')::uuid,'22222222-2222-4222-8222-222222222222'::uuid);
 exception when others then blocked:=true; end;
 if not blocked then raise exception 'Other user forfeit was accepted'; end if;
end;
$ownership$;
reset role;

create function public.verify_omok_ai_pg17_race(p_match uuid)
returns void language plpgsql as $race$
declare
 connection text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 actor constant text:='11111111-1111-4111-8111-111111111111';
 req constant text:='cccc1111-cccc-4111-8111-cccccccccccc';
 input_sql text; first_result text; retry_result text; worker_pid int;
 waiting boolean:=false; i int;
begin
 input_sql:=format('select public.commit_omok_ai_turn(%L::uuid,%L::uuid,%L::uuid,1,'
   || 'to_jsonb(array_fill(null::text,array[15,15])),7,7,7,8)::text',
   p_match,actor,req);
 perform dblink_connect('ai_first',connection);
 perform dblink_connect('ai_retry',connection);
 perform dblink_exec('ai_first','begin');
 perform dblink_exec('ai_first','set local role service_role');
 select result into first_result from dblink('ai_first',input_sql) as t(result text);
 if (first_result::jsonb->>'replayed')<>'false' then
   raise exception 'Initial AI turn did not commit: %',first_result; end if;

 perform dblink_exec('ai_retry','begin');
 perform dblink_exec('ai_retry','set local role service_role');
 perform dblink_exec('ai_retry','set local statement_timeout=8000');
 select pid into worker_pid from dblink('ai_retry','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('ai_retry',input_sql);
 for i in 1..120 loop
   select exists(select 1 from pg_stat_activity
     where pid=worker_pid and wait_event_type='Lock') into waiting;
   exit when waiting;
   perform pg_sleep(0.025);
 end loop;
 if not waiting then raise exception 'AI retry did not wait on match row'; end if;
 perform dblink_exec('ai_first','commit');
 select result into retry_result from dblink_get_result('ai_retry') as t(result text);
 perform result from dblink_get_result('ai_retry') as t(result text);
 perform dblink_exec('ai_retry','commit');
 if (retry_result::jsonb->>'replayed')<>'true'
   or (select count(*) from public.omok_ai_turns where match_id=p_match)<>1
   or (select turn_no from public.omok_ai_matches where id=p_match)<>2
   or (select board_state #>> array['7','7'] from public.omok_ai_matches where id=p_match)<>'black'
   or (select board_state #>> array['7','8'] from public.omok_ai_matches where id=p_match)<>'white'
 then raise exception 'Concurrent retry duplicated/overwrote AI turn'; end if;
 perform dblink_disconnect('ai_first');
 perform dblink_disconnect('ai_retry');
 raise notice 'PASS: service-role concurrent AI turn replay committed exactly once';
end;
$race$;
select public.verify_omok_ai_pg17_race(:'match_id'::uuid);
set role service_role;
select public.forfeit_omok_ai_match(:'match_id'::uuid,'11111111-1111-4111-8111-111111111111');
reset role;
do $terminal$
begin
 if not exists(select 1 from public.omok_ai_matches
    where status='finished' and finish_reason='forfeit' and winner='ai')
  or (select count(*) from public.omok_ai_turns)<>1
 then raise exception 'AI forfeiture did not preserve turn history'; end if;
 raise notice 'PASS: AI forfeit finalizes exactly one owner game';
end;
$terminal$;
select 'PASS: Omok AI migration, guarded settlement, RLS and two-session replay' as result;
