\set ON_ERROR_STOP on
-- Run after tests/omok-pg17-full-stack.sql and tests/omok-pg17-advanced.sql
-- on an ephemeral PostgreSQL 17 service; no remote database connection.
\echo 'Create a second ranked match to check turn expiry'
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.join_omok_ranked_queue();
reset role;
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.join_omok_ranked_queue();
reset role;
select id as timed_ranked_id from public.omok_matches
 where mode='ranked' and status='active'
 order by created_at desc,id desc limit 1 \gset
select set_config('qa.timed_ranked_id', :'timed_ranked_id',false);

\echo 'An outsider cannot close a ranked match'
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $outsider$
declare denied boolean:=false;
begin
 begin
  perform public.expire_omok_ranked_match(current_setting('qa.timed_ranked_id')::uuid);
 exception when others then
  if sqlerrm='MATCH_NOT_FOUND' then denied:=true; else raise; end if;
 end;
 if not denied then raise exception 'OUTSIDER_CLOSED_RANKED_MATCH'; end if;
 if exists(select 1 from public.omok_matches
   where id=current_setting('qa.timed_ranked_id')::uuid)
   then raise exception 'OUTSIDER_READ_RANKED_MATCH'; end if;
end;
$outsider$;
reset role;

\echo 'A participant cannot expire an unexpired turn'
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $too_early$
declare rejected boolean:=false;
begin
 begin
  perform public.expire_omok_ranked_match(current_setting('qa.timed_ranked_id')::uuid);
 exception when others then
  if sqlerrm='TURN_NOT_EXPIRED' then rejected:=true; else raise; end if;
 end;
 if not rejected then raise exception 'PREMATURE_TIMEOUT_ALLOWED'; end if;
end;
$too_early$;
reset role;

\echo 'Force timeout on the disposable test row only'
update public.omok_matches set turn_deadline=clock_timestamp()-interval '2 seconds'
 where id=:'timed_ranked_id'::uuid and mode='ranked' and status='active';
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.expire_omok_ranked_match(:'timed_ranked_id'::uuid);
do $again$
declare rejected boolean:=false;
begin
 begin
  perform public.expire_omok_ranked_match(current_setting('qa.timed_ranked_id')::uuid);
 exception when others then
  if sqlerrm='MATCH_FINISHED' then rejected:=true; else raise; end if;
 end;
 if not rejected then raise exception 'DUPLICATE_TIMEOUT_ALLOWED'; end if;
end;
$again$;
reset role;

do $settlement$
declare mid uuid:=current_setting('qa.timed_ranked_id')::uuid;
  matchrow public.omok_matches%rowtype;
begin
 select * into strict matchrow from public.omok_matches where id=mid;
 if matchrow.status<>'finished' or matchrow.finish_reason<>'timeout'
   or matchrow.winner_id<>matchrow.white_id or matchrow.turn_no<>1
 then raise exception 'TIMEOUT_TERMINAL_STATE_WRONG'; end if;
 if (select count(*) from public.omok_rating_history where match_id=mid)<>2
    or (select count(*) from public.xp_events
      where source_kind='omok_ranked' and source_id=mid)<>2
 then raise exception 'TIMEOUT_SETTLEMENT_NOT_EXACTLY_ONCE'; end if;
 if exists(select 1 from public.profiles
  where id in(matchrow.black_id,matchrow.white_id) and rating<>1000)
 then raise exception 'ALKkAGI_RATING_CHANGED'; end if;
 raise notice 'PASS: outsider/early-timeout denied, exact-once ranked timeout Elo/XP';
end;
$settlement$;
