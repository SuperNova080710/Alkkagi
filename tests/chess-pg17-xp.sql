\set ON_ERROR_STOP on

-- This suite extends omok-pg17-xp.sql on the disposable PostgreSQL 17 CI service.
create extension if not exists dblink;
\i supabase/migrations/20261106074054_chess_casual.sql
\i supabase/migrations/20261106080759_chess_ranked.sql

insert into auth.users(id) values
  ('44444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555'),
  ('66666666-6666-4666-8666-666666666666'),
  ('77777777-7777-4777-8777-777777777777');

create function pg_temp.chess_xp_fixture(room_code text,host_id uuid,guest_id uuid)
returns uuid language plpgsql as $fixture$
declare room_id uuid;
begin
  room_id:=public.chess_create_room(host_id,gen_random_uuid(),room_code);
  perform public.chess_join_room(guest_id,room_code);
  return public.chess_start_match(host_id,room_id);
end;
$fixture$;

select pg_temp.chess_xp_fixture('XPCH2345',
  '44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555') as old_chess \gset
select public.chess_resign('55555555-5555-4555-8555-555555555555',:'old_chess',gen_random_uuid());

\i supabase/migrations/20261111033733_chess_online_xp.sql

select set_config('test.old_chess_xp_id',:'old_chess',false);
do $outcomes$
declare
  winner uuid:='44444444-4444-4444-8444-444444444444';
  loser uuid:='55555555-5555-4555-8555-555555555555';
  casual_id uuid;
  draw_id uuid;
  ranked_id uuid;
  resign_request uuid:=gen_random_uuid();
  timed_out uuid;
begin
  if exists(select 1 from public.xp_events where source_id=current_setting('test.old_chess_xp_id')::uuid)
  then raise exception 'HISTORIC_CHESS_XP_BACKFILLED'; end if;
  casual_id:=pg_temp.chess_xp_fixture('XPCH2346',winner,loser);
  perform public.chess_resign(loser,casual_id,resign_request);
  perform public.chess_resign(loser,casual_id,resign_request);
  draw_id:=pg_temp.chess_xp_fixture('XPCH2347',winner,loser);
  update public.chess_matches set finished_at=now(),finish_reason='stalemate' where id=draw_id;
  if (select count(*) from public.xp_events where source_kind='chess_casual' and
      ((source_id=casual_id and ((user_id=winner and outcome='win' and xp_amount=40)
        or (user_id=loser and outcome='loss' and xp_amount=20)))
      or (source_id=draw_id and outcome='draw' and xp_amount=25)))<>4
    or exists(select 1 from public.chess_rating_events where match_id in (casual_id,draw_id))
  then raise exception 'CHESS_CASUAL_XP_OR_RATING_WRONG'; end if;

  perform public.chess_ranked_queue(winner,'join');
  ranked_id:=(public.chess_ranked_queue(loser,'join')->>'matchId')::uuid;
  if ranked_id is null then raise exception 'CHESS_RANKED_FIXTURE_MISSING'; end if;
  select white_id into strict timed_out from public.chess_matches where id=ranked_id;
  update public.chess_matches set turn_deadline=now()-interval '1 second' where id=ranked_id;
  perform public.chess_expire_ranked(winner,ranked_id);
  perform public.chess_expire_ranked(loser,ranked_id);
  if (select count(*) from public.xp_events where source_kind='chess_ranked' and source_id=ranked_id
      and ((user_id=timed_out and outcome='loss' and xp_amount=35)
        or (user_id<>timed_out and outcome='win' and xp_amount=70)))<>2
    or (select count(*) from public.chess_rating_events where match_id=ranked_id)<>2
    or exists(select 1 from public.profiles where id in(winner,loser) and rating<>1000)
    or (select sum(total_xp) from public.player_progress where user_id in(winner,loser)) is distinct from 215
  then raise exception 'CHESS_RANKED_XP_OR_RATING_WRONG'; end if;
  raise notice 'PASS: chess resignation, draw, timeout, retries and independent RP; historical chess not backfilled';
end;
$outcomes$;

-- Start one account one match below the casual-opponent cap, the other one
-- match below the shared PvP cap. Two concurrent finishes must not both pay.
insert into public.xp_events(user_id,source_kind,source_id,opponent_id,outcome,xp_amount)
select '66666666-6666-4666-8666-666666666666',
  case when n<=2 then 'casual' else 'omok_casual' end,
  gen_random_uuid(),'77777777-7777-4777-8777-777777777777','win',0
from generate_series(1,4) n;
insert into public.xp_events(user_id,source_kind,source_id,outcome,xp_amount)
select '77777777-7777-4777-8777-777777777777',
  (array['ranked','omok_ranked','chess_ranked'])[1+n%3],gen_random_uuid(),'win',0
from generate_series(1,19) n;

select set_config('test.chess_xp_first',pg_temp.chess_xp_fixture('XPCH2348',
  '66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777')::text,false);
select set_config('test.chess_xp_second',pg_temp.chess_xp_fixture('XPCH2349',
  '66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777')::text,false);

do $cap_race$
declare
  player_a uuid:='66666666-6666-4666-8666-666666666666';
  player_b uuid:='77777777-7777-4777-8777-777777777777';
  first_game uuid:=current_setting('test.chess_xp_first')::uuid;
  second_game uuid:=current_setting('test.chess_xp_second')::uuid;
  dsn text:=format('host=127.0.0.1 port=%s dbname=%s user=postgres password=postgres',
    current_setting('port'),current_database());
  second_pid int;
  saw_lock boolean:=false;
begin
  perform dblink_connect('chess_xp_first',dsn);
  perform dblink_connect('chess_xp_second',dsn);
  select pid into second_pid from dblink('chess_xp_second','select pg_backend_pid()') as t(pid int);
  perform dblink_exec('chess_xp_first','begin');
  perform dblink_exec('chess_xp_first','set local role service_role');
  perform dblink_exec('chess_xp_second','set role service_role');
  perform dblink_exec('chess_xp_second','set statement_timeout=10000');
  perform 1 from dblink('chess_xp_first',format(
    'select 1 from public.chess_resign(%L,%L,%L)',player_b,first_game,gen_random_uuid())) as t(ok int);
  if dblink_send_query('chess_xp_second',format(
    'select 1 from public.chess_resign(%L,%L,%L)',player_b,second_game,gen_random_uuid()))<>1
  then raise exception 'CHESS_XP_SECOND_FINISH_NOT_SENT'; end if;
  for attempt in 1..200 loop
    perform pg_stat_clear_snapshot();
    select wait_event_type='Lock' into saw_lock from pg_stat_activity where pid=second_pid;
    exit when saw_lock;
    perform pg_sleep(0.02);
  end loop;
  if saw_lock is distinct from true then raise exception 'CHESS_XP_PROFILE_LOCK_NOT_OBSERVED'; end if;
  perform dblink_exec('chess_xp_first','commit');
  perform 1 from dblink_get_result('chess_xp_second') as t(ok int);
  perform dblink_disconnect('chess_xp_first');
  perform dblink_disconnect('chess_xp_second');
  if (select count(*) from public.xp_events where source_kind='chess_casual'
      and ((source_id=first_game and xp_amount>0) or (source_id=second_game and xp_amount=0)))<>4
    or (select total_xp from public.player_progress where user_id=player_a) is distinct from 40
    or (select total_xp from public.player_progress where user_id=player_b) is distinct from 20
  then raise exception 'CHESS_XP_CONCURRENT_CAP_OVERPAID'; end if;
  raise notice 'PASS: independent PostgreSQL sessions enforce the shared daily and casual-opponent caps';
end;
$cap_race$;
