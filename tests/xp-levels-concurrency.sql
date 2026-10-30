\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 service only. Never connects to hosted Supabase.
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
\i supabase/migrations/202610280002_casual_rooms.sql
\i supabase/migrations/202610280003_casual_game.sql
\i supabase/migrations/202610280006_ranked_queue_and_rating.sql
\i supabase/migrations/202610280007_ranked_atomic_settlement.sql
\i supabase/migrations/202610280008_turn_deadline_recovery.sql
\i supabase/migrations/202610290002_ai_rooms.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290008_xp_levels_v1.sql

-- 19 paid/zero audit records already count toward the 20 PvP/day limit.
insert into public.xp_events(user_id,source_kind,source_id,outcome,xp_amount)
select '11111111-1111-4111-8111-111111111111'::uuid,'ranked',
  ('aaaaaaaa-aaaa-4aaa-8aaa-' || lpad(to_hex(n),12,'0'))::uuid,'win',0
from generate_series(1,19) n;

insert into public.matches(mode,player1_id,player2_id,turn_user_id,board_state)
values('ranked','11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222',
       '11111111-1111-4111-8111-111111111111','{}'),
      ('ranked','11111111-1111-4111-8111-111111111111',
       '33333333-3333-4333-8333-333333333333',
       '11111111-1111-4111-8111-111111111111','{}'),
      ('ranked','11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222',
       '11111111-1111-4111-8111-111111111111','{}');

create function public.verify_xp_match_race() returns void
language plpgsql as $verifyxp$
declare
 v_conn text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 v_a uuid:='11111111-1111-4111-8111-111111111111';
 v_b uuid:='22222222-2222-4222-8222-222222222222';
 v_c uuid:='33333333-3333-4333-8333-333333333333';
 v_first uuid;
 v_second uuid;
 v_rollback uuid;
 v_pid int;
 v_waiting boolean:=false;
 v_result text;
 v_delta integer;
begin
 select id into strict v_first from public.matches
   where player2_id=v_b order by created_at,id limit 1;
 select id into strict v_rollback from public.matches
   where player2_id=v_b and id<>v_first;
 select id into strict v_second from public.matches where player2_id=v_c;

 perform dblink_connect('xp_first',v_conn);
 perform dblink_connect('xp_second',v_conn);
 perform dblink_exec('xp_first','begin');
 perform dblink_exec('xp_first','set local role service_role');
 perform dblink_exec('xp_first','set local statement_timeout = 5000');
 select result into v_result from dblink('xp_first',
   format('select public.forfeit_casual_match(%L::uuid,%L::uuid)::text',v_first,v_b))
   as t(result text);
 if v_result not like '%winnerId%' then
   raise exception 'First ranked match did not finish: %',v_result;
 end if;

 perform dblink_exec('xp_second','begin');
 perform dblink_exec('xp_second','set local role service_role');
 perform dblink_exec('xp_second','set local statement_timeout = 5000');
 select pid into v_pid from dblink('xp_second','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('xp_second',
   format('select public.forfeit_casual_match(%L::uuid,%L::uuid)::text',v_second,v_c));
 for i in 1..100 loop
   select exists(select 1 from pg_stat_activity
     where pid=v_pid and wait_event_type='Lock') into v_waiting;
   exit when v_waiting;
   perform pg_sleep(0.025);
 end loop;
 if not v_waiting then
   raise exception 'Second match completion never waited for the shared profile';
 end if;

 -- Committing the first reward releases the shared profile lock.
 perform dblink_exec('xp_first','commit');
 select result into v_result from dblink_get_result('xp_second') as t(result text);
 perform result from dblink_get_result('xp_second') as t(result text);
 if v_result not like '%winnerId%' then
   raise exception 'Second ranked match failed: %',v_result;
 end if;
 perform dblink_exec('xp_second','commit');

 if (select count(*) from public.xp_events
   where user_id=v_a and source_kind='ranked')<>21 then
    raise exception 'Expected 19 seeded + 2 finished XP events';
 end if;
 if (select coalesce(sum(xp_amount),0) from public.xp_events
   where user_id=v_a and source_id in(v_first,v_second))<>70
   or (select count(*) from public.xp_events
       where user_id=v_a and source_id in(v_first,v_second) and xp_amount=0)<>1 then
   raise exception 'Concurrent daily XP cap was bypassed';
 end if;
 if (select total_xp from public.player_progress where user_id=v_a)<>70
   or (select total_xp from public.player_progress where user_id=v_b)<>35
   or (select total_xp from public.player_progress where user_id=v_c)<>35 then
   raise exception 'XP summary out of sync with two ranked match ledgers';
 end if;
 if (select count(*) from public.rating_history
   where match_id in(v_first,v_second))<>4
   or (select ranked_wins from public.profiles where id=v_a)<>2 then
   raise exception 'Ranked rating/stat settlement did not atomically finish';
 end if;
 raise notice 'PASS: two connections share profile lock, UTC PvP cap 20, XP 70+0, RP+XP records complete';

 -- Rollback must revert XP, rating entries, and the match transition together.
 perform dblink_exec('xp_first','begin');
 perform dblink_exec('xp_first','set local role service_role');
 perform result from dblink('xp_first',
   format('select public.forfeit_casual_match(%L::uuid,%L::uuid)::text',v_rollback,v_b))
   as t(result text);
 perform dblink_exec('xp_first','rollback');
 if (select status from public.matches where id=v_rollback)<>'active'
   or exists(select 1 from public.xp_events where source_id=v_rollback)
   or exists(select 1 from public.rating_history where match_id=v_rollback)
   or (select total_xp from public.player_progress where user_id=v_a)<>70 then
   raise exception 'Rollback left XP or RP partial writes';
 end if;
 perform dblink_disconnect('xp_first');
 perform dblink_disconnect('xp_second');
 raise notice 'PASS: rollback reverts match status, XP ledger, progress and rating history';
end;
$verifyxp$;

select public.verify_xp_match_race();
