\set ON_ERROR_STOP on
-- Only run in the GitHub Actions disposable PostgreSQL 17 container.
-- No hosted Supabase credentials; fixture accounts are synthetic.
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

\echo 'Replay all existing Alkkagi migrations in a clean DB'
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610280002_casual_rooms.sql
\i supabase/migrations/202610280003_casual_game.sql
\i supabase/migrations/202610280004_rematch.sql
\i supabase/migrations/202610280005_initial_board_balance.sql
\i supabase/migrations/202610280006_ranked_queue_and_rating.sql
\i supabase/migrations/202610280007_ranked_atomic_settlement.sql
\i supabase/migrations/202610280008_turn_deadline_recovery.sql
\i supabase/migrations/202610280009_shot_rate_limit.sql
\i supabase/migrations/202610280010_profile_nickname.sql
\i supabase/migrations/202610290001_match_chat.sql
\i supabase/migrations/202610290002_ai_rooms.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290004_security_room_create_limits.sql
\i supabase/migrations/202610290005_friends_v1.sql
\i supabase/migrations/202610290006_direct_messages_v1.sql
\i supabase/migrations/202610290007_room_friend_invites_v1.sql
\i supabase/migrations/202610290008_xp_levels_v1.sql
\i supabase/migrations/202610290009_cosmetics_v1.sql

\echo 'Replay v0.3.0 Omok migrations 001,002,003,004,006'
\i supabase/migrations/202611030001_omok_casual_core.sql
\i supabase/migrations/202611030002_omok_social_and_rematch.sql
\i supabase/migrations/202611030003_omok_ai_matches.sql
\i supabase/migrations/202611030004_omok_ranked.sql
\i supabase/migrations/202611030006_omok_xp.sql

\echo 'Assert no client table writes, participant-only RLS and allowed RPCs'
do $checks$
declare tab text; f text;
begin
 if current_setting('server_version_num')::integer not between 170000 and 179999 then
   raise exception 'PG17 only';
 end if;
 foreach tab in array array[
   'omok_rooms','omok_room_players','omok_matches','omok_moves',
   'omok_match_messages','omok_rematch_votes','omok_ai_matches',
   'omok_ratings','omok_ranked_queue','omok_rating_history'
 ] loop
   if to_regclass('public.'||tab) is null then raise exception 'MISSING_TABLE: %',tab; end if;
   if not (select relrowsecurity from pg_class where oid=('public.'||tab)::regclass)
     then raise exception 'RLS_DISABLED: %',tab; end if;
   if has_table_privilege('anon','public.'||tab,'SELECT') or
      has_table_privilege('authenticated','public.'||tab,'INSERT') or
      has_table_privilege('authenticated','public.'||tab,'UPDATE') or
      has_table_privilege('authenticated','public.'||tab,'DELETE') then
     raise exception 'CLIENT_PRIVILEGE_LEAK: %',tab; end if;
 end loop;
 foreach f in array array[
   'public.create_omok_room(text)', 'public.join_omok_room(text)',
   'public.start_omok_match(uuid)',
   'public.play_omok_move(uuid,uuid,integer,integer,integer)',
   'public.forfeit_omok_match(uuid)'
 ] loop
   if to_regprocedure(f) is null then raise exception 'MISSING_RPC: %',f; end if;
   if has_function_privilege('anon',f,'EXECUTE') or
      not has_function_privilege('authenticated',f,'EXECUTE')
     then raise exception 'RPC_GRANT: %',f; end if;
 end loop;
 if (select count(*) from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename in('omok_rooms','omok_matches','omok_moves'))<>3
   then raise exception 'REALTIME_OMOK_MISSING'; end if;
 raise notice 'PASS: schema, RLS, ACL, RPC and Realtime';
end;
$checks$;

\echo 'Authenticate two users and settle a casual match once'
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_room('ABCDEFGH') as room_id \gset
reset role;
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.join_omok_room('ABCDEFGH');
reset role;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.start_omok_match(:'room_id'::uuid) as match_id \gset
reset role;

set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $outsider$
begin
 if exists(select 1 from public.omok_matches) or
    exists(select 1 from public.omok_rooms) or
    exists(select 1 from public.omok_moves) then
   raise exception 'Nonparticipant SELECT leaked match data';
 end if;
end;
$outsider$;
reset role;
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.forfeit_omok_match(:'match_id'::uuid);
reset role;

do $settled$
declare mid uuid;
begin
 select m.id into strict mid from public.omok_matches m
 join public.omok_rooms r on r.id=m.room_id where r.code='ABCDEFGH';
 if (select status from public.omok_matches where id=mid)<>'finished'
    or (select winner_id from public.omok_matches where id=mid)
       <>'11111111-1111-4111-8111-111111111111'::uuid then
   raise exception 'Omok casual settlement failed'; end if;
 if (select count(*) from public.xp_events
    where source_id=mid and source_kind='omok_casual')<>2
    then raise exception 'Omok XP transition failed'; end if;
 if (select count(*) from public.xp_events
    where source_id=mid and source_kind='omok_casual' and xp_amount>0)<>2
    then raise exception 'Omok XP rewards missing'; end if;
 raise notice 'PASS: Omok forfeit, winner and exactly-once XP trigger';
end;
$settled$;

\echo 'Verify independent ratings and unchanged Alkkagi RP'
do $ratings$
begin
 if exists(select 1 from public.profiles
   where id in('11111111-1111-4111-8111-111111111111'::uuid,
               '22222222-2222-4222-8222-222222222222'::uuid)
     and rating<>1000) then
   raise exception 'Alkkagi rating was unexpectedly changed'; end if;
 raise notice 'PASS: Alkkagi rating unaffected by Omok casual';
end;
$ratings$;
