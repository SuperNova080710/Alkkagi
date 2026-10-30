\set ON_ERROR_STOP on
-- Integration replay on an EPHEMERAL GitHub Actions PostgreSQL 17 service ONLY.
-- Never connect this script to Supabase, production or a user-supplied PGHOST.
-- All synthetic users below are invented fixed fixture UUIDs.
\echo 'R3 PG17: create synthetic Supabase-compatible roles/auth baseline'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $authuid$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$authuid$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create publication supabase_realtime;
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

\echo 'R3 PG17: replay original baseline (001-003), full earlier P1/P2/P3/AI migrations'
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

\echo 'R3 PG17: apply 004 - room creation anti-abuse'
\i supabase/migrations/202610290004_security_room_create_limits.sql
do $check004$
begin
  if position('ROOM_ACTIVE_LIMIT' in (
    select p.prosrc from pg_catalog.pg_proc p
    where p.oid=to_regprocedure('public.create_casual_room(text)')
  ))=0 then raise exception '004 limiter missing'; end if;
end;
$check004$;

\echo 'R3 PG17: apply 005 - friends and blocks'
\i supabase/migrations/202610290005_friends_v1.sql
\echo 'R3 PG17: apply 006 - direct messages and realtime'
\i supabase/migrations/202610290006_direct_messages_v1.sql
\echo 'R3 PG17: apply 007 - room friend invites'
\i supabase/migrations/202610290007_room_friend_invites_v1.sql
\echo 'R3 PG17: apply 008 - XP and levels'
\i supabase/migrations/202610290008_xp_levels_v1.sql
\echo 'R3 PG17: apply 009 - cosmetic inventory and equip'
\i supabase/migrations/202610290009_cosmetics_v1.sql

\echo 'R3 PG17: assert all 004-009 objects, table grants, RLS and publication'
do $security$
declare
  v_table text;
  v_function text;
begin
  foreach v_table in array ARRAY[
    'public.friend_links','public.player_blocks',
    'public.dm_threads','public.dm_messages','public.dm_read_state',
    'public.room_friend_invites','public.xp_events','public.player_progress',
    'public.cosmetic_items','public.player_cosmetic_inventory',
    'public.player_cosmetic_loadouts'
  ] loop
    if to_regclass(v_table) is null then
      raise exception 'Expected table missing: %',v_table;
    end if;
    if not exists(select 1 from pg_catalog.pg_class c
      where c.oid=to_regclass(v_table) and c.relrowsecurity) then
      raise exception 'RLS OFF: %',v_table;
    end if;
    if pg_catalog.has_table_privilege('anon',v_table,'INSERT')
       or pg_catalog.has_table_privilege('authenticated',v_table,'UPDATE')
       or pg_catalog.has_table_privilege('authenticated',v_table,'DELETE') then
      raise exception 'Client mutation privilege exposed: %',v_table;
    end if;
  end loop;
  foreach v_function in array ARRAY[
    'public.send_friend_request(uuid)',
    'public.send_direct_message(uuid,text,uuid)',
    'public.send_room_friend_invite(uuid,uuid)',
    'public.get_player_experience(uuid)',
    'public.get_my_cosmetics()',
    'public.equip_my_cosmetic(text)'
  ] loop
    if to_regprocedure(v_function) is null then
      raise exception 'Expected RPC missing: %',v_function;
    end if;
    if pg_catalog.has_function_privilege('anon',v_function,'EXECUTE')
      or not pg_catalog.has_function_privilege('authenticated',v_function,'EXECUTE') then
      raise exception 'RPC role EXECUTE not restricted: %',v_function;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public'
        and tablename in('dm_threads','dm_messages'))<>2 then
    raise exception 'DM Realtime publication missing tables';
  end if;
  if (select count(*) from pg_catalog.pg_trigger
      where tgname in ('xp_pvp_match_finished','xp_ai_match_finished')
        and not tgisinternal and tgenabled <> 'D')<>2 then
    raise exception 'XP settlement trigger(s) not installed';
  end if;
  if (select count(*) from public.cosmetic_items
      where published and unlock_kind='starter')<>2 then
    raise exception 'Missing exact two starter cosmetic items';
  end if;
  raise notice 'PASS PG17: 004-009 objects, RLS/ACL, DM realtime, XP triggers, starter catalog';
end;
$security$;

\echo 'R3 PG17: verify XP settlement (one transition only) and level unlock'
insert into public.matches(mode,player1_id,player2_id,turn_user_id,board_state)
values('ranked','11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222',
       '11111111-1111-4111-8111-111111111111','{}'),
      ('ranked','11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222',
       '11111111-1111-4111-8111-111111111111','{}');
update public.matches set status='finished',
  winner_id='11111111-1111-4111-8111-111111111111',finished_at=now()
where mode='ranked';
-- Repeated finished->finished updates must not grant XP again.
update public.matches set status='finished' where mode='ranked';

do $settlement$
begin
  if (select count(*) from public.xp_events where source_kind='ranked')<>4
    or (select total_xp from public.player_progress
      where user_id='11111111-1111-4111-8111-111111111111')<>140
    or (select total_xp from public.player_progress
      where user_id='22222222-2222-4222-8222-222222222222')<>70 then
    raise exception 'XP settlement not atomic, incorrect, or duplicated';
  end if;
  raise notice 'PASS PG17: two ranked wins 140XP, two losses 70XP, no duplicate events';
end;
$settlement$;

\echo 'R3 PG17: authenticated self equip and other-user RLS isolation'
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $owner$
declare
  v_inventory jsonb;
  v_loadout jsonb;
begin
  v_inventory:=public.get_my_cosmetics();
  if (v_inventory->>'level')::integer<>2
     or not exists (
       select 1 from public.player_cosmetic_inventory
       where user_id=auth.uid() and item_code='avatar-orbit'
     ) then raise exception 'XP level 2 cosmetic not unlocked'; end if;
  v_loadout:=public.equip_my_cosmetic('avatar-orbit');
  if v_loadout->>'avatarCode'<>'avatar-orbit' then
    raise exception 'Owner equip did not commit to loadout';
  end if;
  raise notice 'PASS PG17: level 2 unlock and owner-only avatar equip';
end;
$owner$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $other$
declare v_public jsonb;
begin
  if exists(
    select 1 from public.player_cosmetic_inventory
    where user_id='11111111-1111-4111-8111-111111111111'
  ) then raise exception 'RLS revealed another user inventory'; end if;
  v_public:=public.get_public_player_cosmetics(
    '11111111-1111-4111-8111-111111111111');
  if v_public->>'avatarCode'<>'avatar-orbit' then
    raise exception 'Public equipped code mismatch';
  end if;
  raise notice 'PASS PG17: other user inventory isolated, public equip code only';
end;
$other$;
commit;

\echo 'PASS PG17: all 004-009 migrations + auth/RLS/Realtime/XP/cosmetics integrated'
