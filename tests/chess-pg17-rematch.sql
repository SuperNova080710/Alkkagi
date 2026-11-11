\set ON_ERROR_STOP on

-- Run from omok-pg17-full-stack.sql against a disposable PostgreSQL 17 server.
-- The dblink sessions use the same local postgres credentials as the CI service.
create extension if not exists dblink;
\i supabase/migrations/20261106074054_chess_casual.sql
\i supabase/migrations/20261106080759_chess_ranked.sql
\i supabase/migrations/20261106084502_chess_friend_invites.sql

set role service_role;
select public.chess_create_room('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'CHES2345') as chess_room \gset
select public.chess_join_room('22222222-2222-4222-8222-222222222222','CHES2345');
select public.chess_start_match('11111111-1111-4111-8111-111111111111',:'chess_room') as chess_match \gset
select public.chess_resign('11111111-1111-4111-8111-111111111111',:'chess_match',gen_random_uuid());
reset role;

select set_config('test.chess_match_id',:'chess_match',false);
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select set_config('test.chess_v041_snapshot',public.chess_match_snapshot(:'chess_match')::text,false);
reset role;

\i supabase/migrations/20261111025703_chess_casual_rematch.sql

do $race$
declare
  original_id uuid:=current_setting('test.chess_match_id')::uuid;
  first_actor uuid:='11111111-1111-4111-8111-111111111111';
  second_actor uuid:='22222222-2222-4222-8222-222222222222';
  dsn text:=format('host=127.0.0.1 port=%s dbname=%s user=postgres password=postgres',
    current_setting('port'),current_database());
  second_pid int;
  saw_lock boolean:=false;
  successor uuid;
begin
  perform dblink_connect('chess_white',dsn);
  perform dblink_connect('chess_black',dsn);
  select pid into second_pid from dblink('chess_black','select pg_backend_pid()') as t(pid int);
  perform dblink_exec('chess_white','begin');
  perform dblink_exec('chess_white','set local role service_role');
  perform dblink_exec('chess_black','set role service_role');
  perform dblink_exec('chess_black','set statement_timeout=10000');
  perform 1 from dblink('chess_white',format(
    'select 1 from public.chess_vote_rematch(%L,%L,%L)',first_actor,original_id,'CHES2346')) as t(ok int);
  if dblink_send_query('chess_black',format(
    'select 1 from public.chess_vote_rematch(%L,%L,%L)',second_actor,original_id,'CHES2347'))<>1 then
    raise exception 'SECOND_VOTE_NOT_SENT';
  end if;
  for attempt in 1..200 loop
    perform pg_stat_clear_snapshot();
    select wait_event_type='Lock' into saw_lock from pg_stat_activity where pid=second_pid;
    exit when saw_lock;
    perform pg_sleep(0.02);
  end loop;
  if saw_lock is distinct from true then raise exception 'SECOND_VOTE_DID_NOT_WAIT'; end if;
  perform dblink_exec('chess_white','commit');
  perform 1 from dblink_get_result('chess_black') as t(ok int);
  perform dblink_disconnect('chess_white');
  perform dblink_disconnect('chess_black');

  select next_match_id into strict successor from public.chess_rematches r where r.match_id=original_id;
  perform public.chess_vote_rematch(second_actor,original_id,'CHES2348');
  if (select count(*) from public.chess_rooms)<>2 or (select count(*) from public.chess_matches)<>2
    or not exists(select 1 from public.chess_matches m where m.id=successor
      and m.white_id=second_actor and m.black_id=first_actor and m.ply=0 and m.finished_at is null)
    or not exists(select 1 from public.chess_matches m where m.id=original_id and m.finish_reason='resignation')
  then raise exception 'CHESS_REMATCH_NOT_IDEMPOTENT'; end if;
  perform set_config('test.chess_successor',successor::text,false);
  raise notice 'PASS: two PostgreSQL sessions contended on the original match and created one room and match';
end;
$race$;

set role authenticated;
do $visibility$
declare
  original_id uuid:=current_setting('test.chess_match_id')::uuid;
  successor uuid:=current_setting('test.chess_successor')::uuid;
  snapshot jsonb;
  actor uuid;
begin
  foreach actor in array array['11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    snapshot:=public.chess_match_snapshot(original_id);
    if snapshot-'rematch' is distinct from current_setting('test.chess_v041_snapshot')::jsonb
      or snapshot#>>'{rematch,nextMatchId}' is distinct from successor::text
      or not exists(select 1 from public.chess_rematches r where r.match_id=original_id and r.next_match_id=successor)
    then raise exception 'CHESS_PARTICIPANT_SNAPSHOT_CHANGED'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  if public.chess_match_snapshot(original_id) is not null or exists(select 1 from public.chess_rematches)
  then raise exception 'CHESS_OUTSIDER_CAN_READ_REMATCH'; end if;
  if has_function_privilege('authenticated','public.chess_vote_rematch(uuid,uuid,text)','EXECUTE')
    or has_table_privilege('authenticated','public.chess_rematches','INSERT,UPDATE')
  then raise exception 'CHESS_REMATCH_WRITE_ACCESS'; end if;
  raise notice 'PASS: both participants see the successor, outsider RLS denies it, and v0.4.1 snapshot fields remain identical';
end;
$visibility$;
reset role;

do $policy$
declare
  white_id uuid:='11111111-1111-4111-8111-111111111111';
  black_id uuid:='22222222-2222-4222-8222-222222222222';
  ranked_id uuid;
  prior_id uuid:=current_setting('test.chess_match_id')::uuid;
begin
  if not exists(
    select 1 from pg_publication_tables t join pg_publication p on p.pubname=t.pubname
    where t.pubname='supabase_realtime' and t.schemaname='public'
      and t.tablename='chess_rematches' and p.pubinsert and p.pubupdate
  ) then raise exception 'CHESS_REMATCH_PUBLICATION_MISSING'; end if;
  perform public.chess_ranked_queue(white_id,'join');
  ranked_id:=(public.chess_ranked_queue(black_id,'join')->>'matchId')::uuid;
  if ranked_id is null then raise exception 'CHESS_RANKED_FIXTURE_MISSING'; end if;
  perform public.chess_resign(white_id,ranked_id,gen_random_uuid());
  begin
    perform public.chess_vote_rematch(white_id,ranked_id,'CHES2348');
    raise exception 'CHESS_RANKED_REMATCH_ACCEPTED';
  exception when raise_exception then
    if sqlerrm<>'REMATCH_NOT_AVAILABLE' then raise; end if;
  end;
  update public.chess_matches set finished_at=now()-interval '31 minutes' where id=prior_id;
  begin
    perform public.chess_vote_rematch(black_id,prior_id,'CHES2349');
    raise exception 'CHESS_EXPIRED_REMATCH_ACCEPTED';
  exception when raise_exception then
    if sqlerrm<>'REMATCH_EXPIRED' then raise; end if;
  end;
  raise notice 'PASS: ranked and expired rematches are rejected; publication includes INSERT and UPDATE';
end;
$policy$;
