\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 only. Never use hosted Supabase credentials.
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
\i supabase/migrations/202611030004_omok_ranked.sql

do $acl$
begin
 if current_setting('server_version_num')::int not between 170000 and 179999
   or not (select relrowsecurity from pg_class where oid='public.omok_ratings'::regclass)
   or not (select relrowsecurity from pg_class where oid='public.omok_rating_history'::regclass)
   or has_table_privilege('anon','public.omok_ratings','SELECT')
   or has_table_privilege('authenticated','public.omok_ratings','UPDATE')
   or has_table_privilege('authenticated','public.omok_ranked_queue','INSERT')
   or has_function_privilege('anon','public.join_omok_ranked_queue()','EXECUTE')
   or has_function_privilege('anon','public.expire_omok_ranked_match(uuid)','EXECUTE')
   or not has_function_privilege('authenticated','public.join_omok_ranked_queue()','EXECUTE')
 then raise exception 'PG17 ranked authorization/RLS regression'; end if;
 raise notice 'PASS: PG17 ranked migrations, ACL, RLS';
end;
$acl$;

create function public.verify_omok_ranked_queue_race()
returns uuid language plpgsql as $race$
declare
 connection text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 alice constant text:='11111111-1111-4111-8111-111111111111';
 bob constant text:='22222222-2222-4222-8222-222222222222';
 alice_response text; bob_response text; game uuid; worker_pid int;
 waiting boolean:=false; i int;
begin
 perform dblink_connect('ranked_alice',connection);
 perform dblink_connect('ranked_bob',connection);
 perform dblink_exec('ranked_alice','begin');
 perform dblink_exec('ranked_alice','set local role authenticated');
 perform dblink_exec('ranked_alice',format('set local request.jwt.claim.sub=%L',alice));
 select result into alice_response from dblink('ranked_alice',
   'select public.join_omok_ranked_queue()::text') as t(result text);
 if (alice_response::jsonb->>'status')<>'queued' then
   raise exception 'First queue entry not queued: %',alice_response; end if;

 perform dblink_exec('ranked_bob','begin');
 perform dblink_exec('ranked_bob','set local role authenticated');
 perform dblink_exec('ranked_bob',format('set local request.jwt.claim.sub=%L',bob));
 perform dblink_exec('ranked_bob','set local statement_timeout=8000');
 select pid into worker_pid from dblink('ranked_bob','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('ranked_bob','select public.join_omok_ranked_queue()::text');
 for i in 1..120 loop
   select exists(select 1 from pg_stat_activity
     where pid=worker_pid and wait_event_type='Lock') into waiting;
   exit when waiting;
   perform pg_sleep(0.025);
 end loop;
 if not waiting then raise exception 'Queue entries did not serialize'; end if;
 perform dblink_exec('ranked_alice','commit');
 select result into bob_response from dblink_get_result('ranked_bob') as t(result text);
 perform dblink_exec('ranked_bob','commit');
 if (bob_response::jsonb->>'status')<>'matched' then
   raise exception 'Concurrent matchmaking did not form a match: %',bob_response; end if;
 game:=(bob_response::jsonb->>'matchId')::uuid;
 if (select count(*) from public.omok_matches where mode='ranked')<>1
    or (select count(*) from public.omok_ranked_queue)<>0
    or (select count(*) from public.omok_ratings)<>2
    or (select turn_deadline from public.omok_matches where id=game)<=clock_timestamp()
 then raise exception 'Queue race duplicated matches or lost deadline'; end if;
 perform dblink_disconnect('ranked_alice');
 perform dblink_disconnect('ranked_bob');
 raise notice 'PASS: concurrent queue entries create one ranked match';
 return game;
end;
$race$;
select public.verify_omok_ranked_queue_race() as match_id \gset

-- Confirm participant isolation before any finish.
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $outsider$
begin
 if exists(select 1 from public.omok_matches where mode='ranked')
   or exists(select 1 from public.omok_ratings)
   or exists(select 1 from public.omok_rating_history) then
   raise exception 'Outsider read private ranked records'; end if;
end;
$outsider$;
reset role;

create function public.verify_omok_ranked_timeout_race(p_match uuid)
returns void language plpgsql as $race$
declare
 connection text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 alice constant text:='11111111-1111-4111-8111-111111111111';
 current_turn uuid; expiry text; worker_pid int;
 waiting boolean:=false; i int;
begin
 update public.omok_matches set turn_deadline=clock_timestamp()-interval '1 second'
  where id=p_match and status='active';
 select turn_user_id into strict current_turn from public.omok_matches where id=p_match;
 perform dblink_connect('ranked_expire',connection);
 perform dblink_connect('ranked_move',connection);
 perform dblink_exec('ranked_expire','begin');
 perform dblink_exec('ranked_expire','set local role authenticated');
 perform dblink_exec('ranked_expire',format('set local request.jwt.claim.sub=%L',alice));
 select result into expiry from dblink('ranked_expire',
   format('select public.expire_omok_ranked_match(%L::uuid)::text',p_match))
   as t(result text);
 if (expiry::jsonb->>'finishReason')<>'timeout' then
   raise exception 'Timeout not settled: %',expiry; end if;

 perform dblink_exec('ranked_move','begin');
 perform dblink_exec('ranked_move','set local role authenticated');
 perform dblink_exec('ranked_move',format('set local request.jwt.claim.sub=%L',current_turn));
 perform dblink_exec('ranked_move','set local statement_timeout=8000');
 select pid into worker_pid from dblink('ranked_move','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('ranked_move',format(
   'select public.play_omok_move(%L::uuid,%L::uuid,1,7,7)::text',
   p_match,'aaaa1111-aaaa-4111-8111-aaaaaaaaaaaa'));
 for i in 1..120 loop
   select exists(select 1 from pg_stat_activity
     where pid=worker_pid and wait_event_type='Lock') into waiting;
   exit when waiting;
   perform pg_sleep(0.025);
 end loop;
 if not waiting then raise exception 'Move did not serialize behind timeout'; end if;
 perform dblink_exec('ranked_expire','commit');
 perform result from dblink_get_result('ranked_move',false) as t(result text);
 if dblink_error_message('ranked_move') not like '%MATCH_FINISHED%'
   and dblink_error_message('ranked_move') not like '%TURN_EXPIRED%' then
   raise exception 'Late move unexpectedly succeeded: %',dblink_error_message('ranked_move');
 end if;
 perform dblink_exec('ranked_move','rollback');
 if (select count(*) from public.omok_rating_history where match_id=p_match)<>2
   or (select count(*) from public.omok_moves where match_id=p_match)<>0
   or (select count(*) from public.omok_matches where id=p_match and status='finished')<>1
   or (select sum(delta) from public.omok_rating_history where match_id=p_match)<>0
   or exists(select 1 from public.profiles where rating<>1000) then
   raise exception 'Timeout race duplicated Elo or changed Alkkagi RP'; end if;
 perform dblink_disconnect('ranked_expire');
 perform dblink_disconnect('ranked_move');
 raise notice 'PASS: timeout and move race settled one Elo result';
end;
$race$;
select public.verify_omok_ranked_timeout_race(:'match_id'::uuid);
select 'PASS: Omok ranked PostgreSQL17 concurrent queue, timeout, ACL, Elo isolation' as result;
