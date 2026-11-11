\set ON_ERROR_STOP on
-- Disposable PostgreSQL17 account XP cross-game regression. No remote credentials.
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

-- Real v0.2.0 XP 008 dependencies, not a mocked XP table.
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610280002_casual_rooms.sql
\i supabase/migrations/202610280003_casual_game.sql
\i supabase/migrations/202610280006_ranked_queue_and_rating.sql
\i supabase/migrations/202610280007_ranked_atomic_settlement.sql
\i supabase/migrations/202610280008_turn_deadline_recovery.sql
\i supabase/migrations/202610290002_ai_rooms.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290005_friends_v1.sql
\i supabase/migrations/202610290008_xp_levels_v1.sql
\i supabase/migrations/202611030001_omok_casual_core.sql
\i supabase/migrations/202611030002_omok_social_and_rematch.sql
\i supabase/migrations/202611030003_omok_ai_matches.sql
\i supabase/migrations/202611030004_omok_ranked.sql
\i supabase/migrations/202611030005_omok_friend_invites.sql
\i supabase/migrations/202611030006_omok_xp.sql

do $acl$
begin
 if current_setting('server_version_num')::int not between 170000 and 179999
   or has_table_privilege('anon','public.xp_events','SELECT')
   or has_table_privilege('authenticated','public.xp_events','INSERT')
   or has_function_privilege('authenticated',
       'private.record_omok_xp(text,uuid,uuid,uuid,text,integer)','EXECUTE')
   or not (select relrowsecurity from pg_class where oid='public.xp_events'::regclass)
   or not exists(select 1 from pg_trigger
       where tgrelid='public.omok_matches'::regclass and tgname='xp_omok_pvp_finished' and not tgisinternal)
 then raise exception 'Cross-game XP migration, RLS, or trigger failure'; end if;
 raise notice 'PASS: PG17 legacy 008 and Omok 001-006 migrations, XP ACL';
end;
$acl$;

-- Award one actual legacy casual match before Omok begins.
insert into public.rooms(code,owner_id,status)
 values('ABCD2345','11111111-1111-4111-8111-111111111111','playing')
 returning id as legacy_room \gset
insert into public.matches(room_id,mode,player1_id,player2_id,turn_user_id,board_state)
 values(:'legacy_room'::uuid,'casual',
 '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111','{"pieces":[]}'::jsonb)
 returning id as legacy_match \gset
update public.matches set status='finished',
 winner_id='11111111-1111-4111-8111-111111111111',
 finished_at=now() where id=:'legacy_match'::uuid;

do $legacy$
begin
 if (select xp_amount from public.xp_events
       where source_kind='casual' and user_id='11111111-1111-4111-8111-111111111111')<>40
   or (select xp_amount from public.xp_events
       where source_kind='casual' and user_id='22222222-2222-4222-8222-222222222222')<>20
 then raise exception 'Existing Alkkagi XP contract changed'; end if;
end;
$legacy$;

-- Two different Omok finishes for the same two profiles execute concurrently.
insert into public.omok_rooms(code,owner_id,status)
 values('ABCDEFGH','11111111-1111-4111-8111-111111111111','playing')
 returning id as omok_room1 \gset
insert into public.omok_rooms(code,owner_id,status)
 values('ABCDEFGA','11111111-1111-4111-8111-111111111111','playing')
 returning id as omok_room2 \gset
insert into public.omok_matches(mode,room_id,black_id,white_id,turn_user_id,board_state)
 values('casual',:'omok_room1'::uuid,
 '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 to_jsonb(array_fill(null::text,array[15,15])))
 returning id as omok_match1 \gset
insert into public.omok_matches(mode,room_id,black_id,white_id,turn_user_id,board_state)
 values('casual',:'omok_room2'::uuid,
 '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 to_jsonb(array_fill(null::text,array[15,15])))
 returning id as omok_match2 \gset

create function public.verify_omok_pg17_xp_race(p_first uuid,p_second uuid)
returns void language plpgsql as $race$
declare
 connection text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 worker_pid int; waiting boolean:=false; i int; result text;
begin
 perform dblink_connect('xp_first',connection);
 perform dblink_connect('xp_second',connection);
 perform dblink_exec('xp_first','begin');
 select t.result into result from dblink('xp_first',
   format('update public.omok_matches set status=''finished'','
      ||' winner_id=''11111111-1111-4111-8111-111111111111'','
      ||' finish_reason=''five'',finished_at=now() where id=%L::uuid returning status',p_first))
   as t(result text);
 if result<>'finished' then raise exception 'First XP finish did not execute'; end if;
 perform dblink_exec('xp_second','begin');
 perform dblink_exec('xp_second','set local statement_timeout=8000');
 select pid into worker_pid from dblink('xp_second','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('xp_second',
   format('update public.omok_matches set status=''finished'','
      ||' winner_id=''11111111-1111-4111-8111-111111111111'','
      ||' finish_reason=''five'',finished_at=now() where id=%L::uuid returning status',p_second));
 for i in 1..120 loop
   select exists(select 1 from pg_stat_activity
     where pid=worker_pid and wait_event_type='Lock') into waiting;
   exit when waiting;
   perform pg_sleep(0.025);
 end loop;
 if not waiting then raise exception 'XP completion did not lock shared profiles'; end if;
 perform dblink_exec('xp_first','commit');
 select t.result into result from dblink_get_result('xp_second') as t(result text);
 perform t.result from dblink_get_result('xp_second') as t(result text);
 perform dblink_exec('xp_second','commit');
 if result<>'finished' then raise exception 'Second XP finish failed'; end if;
 if (select count(*) from public.xp_events where source_kind='omok_casual')<>4
   or (select total_xp from public.player_progress
       where user_id='11111111-1111-4111-8111-111111111111')<>120
   or (select total_xp from public.player_progress
       where user_id='22222222-2222-4222-8222-222222222222')<>60 then
   raise exception 'Concurrent Omok XP did not serialize or duplicate award'; end if;
 perform dblink_disconnect('xp_first');
 perform dblink_disconnect('xp_second');
 raise notice 'PASS: two Omok games serialize with legacy XP and grant exactly once';
end;
$race$;
select public.verify_omok_pg17_xp_race(:'omok_match1'::uuid,:'omok_match2'::uuid);

-- 20 total legacy + Omok PvP events for Alice triggers shared daily limit.
insert into public.xp_events(user_id,source_kind,source_id,opponent_id,outcome,xp_amount)
select '11111111-1111-4111-8111-111111111111','ranked',
 gen_random_uuid(),'22222222-2222-4222-8222-222222222222','win',0
from generate_series(1,17);

insert into public.omok_rooms(code,owner_id,status)
 values('ABCDEFGB','11111111-1111-4111-8111-111111111111','playing')
 returning id as capped_room \gset
insert into public.omok_matches(mode,room_id,black_id,white_id,turn_user_id,board_state)
 values('casual',:'capped_room'::uuid,
 '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 to_jsonb(array_fill(null::text,array[15,15])))
 returning id as capped_match \gset
update public.omok_matches set status='finished',
 winner_id='11111111-1111-4111-8111-111111111111',
 finish_reason='five',finished_at=now() where id=:'capped_match'::uuid;
select set_config('qa.cap_match', :'capped_match', false);
do $cap$
begin
 if (select xp_amount from public.xp_events where
  source_kind='omok_casual' and source_id=current_setting('qa.cap_match')::uuid
  and user_id='11111111-1111-4111-8111-111111111111')<>0
 then raise exception 'Cross-game daily cap failed'; end if;
end;
$cap$;

-- AI uses a separate daily pool, and the legacy profile rating stays isolated.
insert into public.omok_ai_matches(owner_id,difficulty,board_state)
 values('11111111-1111-4111-8111-111111111111','hard',
 to_jsonb(array_fill(null::text,array[15,15])))
 returning id as ai_match \gset
update public.omok_ai_matches set status='finished',winner='human',
 finish_reason='five',finished_at=now() where id=:'ai_match'::uuid;
do $final$
begin
 if (select total_xp from public.player_progress
      where user_id='11111111-1111-4111-8111-111111111111')<>140
   or exists(select 1 from public.profiles where rating<>1000)
   or (select count(*) from public.xp_events
       where source_kind='omok_ai' and xp_amount=20)<>1
   or (select count(*) from public.xp_events where
       source_kind='omok_casual' and user_id='11111111-1111-4111-8111-111111111111')<>3
 then raise exception 'Cross-game XP, AI pool, or Alkkagi RP changed'; end if;
 raise notice 'PASS: cross-game daily cap and separate AI XP pool';
end;
$final$;
select 'PASS: PostgreSQL17 full Omok migrations and legacy XP regression' as result;

\ir chess-pg17-xp.sql
