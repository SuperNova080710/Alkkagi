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
-- Assert observable enforcement, not just a function-body marker.
-- Run against synthetic users; create_casual_room authenticates via auth.uid().
-- All fixture rooms are closed after the checks, so subsequent migrations are
-- exercised without active-room side effects.
begin;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $check004$
declare
  i integer;
  error_seen boolean;
  candidate text;
begin
  for i in 1..5 loop
    candidate := 'ABCDEFG' || substr('HJKLMNPQRSTUVXYZ',i,1);
    perform public.create_casual_room(candidate);
  end loop;

  error_seen:=false;
  begin
    perform public.create_casual_room('ABCDEFGN');
  exception when others then
    if SQLERRM<>'ROOM_ACTIVE_LIMIT' then raise; end if;
    error_seen:=true;
  end;
  if not error_seen then
    raise exception '004 failed: sixth unexpired waiting room was allowed';
  end if;

  update public.rooms set status='closed'
  where owner_id=auth.uid() and status='waiting';

  -- Closed rooms still count for the rolling 10-minute limit.
  for i in 6..10 loop
    candidate := 'ABCDEFG' || substr('HJKLMNPQRSTUVXYZ',i,1);
    perform public.create_casual_room(candidate);
    update public.rooms set status='closed' where code=candidate;
  end loop;

  error_seen:=false;
  begin
    perform public.create_casual_room('ABCDEFGT');
  exception when others then
    if SQLERRM<>'ROOM_RATE_LIMIT' then raise; end if;
    error_seen:=true;
  end;
  if not error_seen then
    raise exception '004 failed: eleventh room within 10 minutes was allowed';
  end if;
  if (select count(*) from public.rooms where owner_id=auth.uid())<>10
    or (select count(*) from public.room_players rp
      join public.rooms r on r.id=rp.room_id where r.owner_id=auth.uid())<>10
    or exists(select 1 from public.rooms
      where owner_id=auth.uid() and status='waiting') then
    raise exception '004 failed: rejected request left a partial room or seat';
  end if;
  raise notice 'PASS PG17: 004 active-room and 10-minute limits enforced, no partial writes';
end;
$check004$;
commit;

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
-- Shared permission assertion is also used by the negative regression cases,
-- so a future accidental GRANT must make the same production-facing check fail.
create function pg_temp.assert_no_client_table_writes() returns void
language plpgsql as $permission_guard$
declare
  v_table text;
  v_role text;
  v_privilege text;
begin
  foreach v_table in array ARRAY[
    'public.friend_links','public.player_blocks',
    'public.dm_threads','public.dm_messages','public.dm_read_state',
    'public.room_friend_invites','public.xp_events','public.player_progress',
    'public.cosmetic_items','public.player_cosmetic_inventory',
    'public.player_cosmetic_loadouts'
  ] loop
    foreach v_role in array ARRAY['anon','authenticated'] loop
      foreach v_privilege in array ARRAY['INSERT','UPDATE','DELETE'] loop
        if pg_catalog.has_table_privilege(v_role,v_table,v_privilege) then
          raise exception 'CLIENT_WRITE_PRIVILEGE: % on % to %',
            v_privilege,v_table,v_role;
        end if;
      end loop;
    end loop;
  end loop;
end;
$permission_guard$;
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
    -- The helper checks all six role x write-privilege combinations.
    -- Table-level privileges are not a substitute for RLS policy inspection.
  end loop;
  perform pg_temp.assert_no_client_table_writes();
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

\echo 'R3 PG17: negative security fixture for all six write-permission combinations'
do $negative_permissions$
declare
  v_role text;
  v_privilege text;
  failure_detected boolean;
begin
  -- Explicitly grant exactly one forbidden permission, ensure that the same
  -- production-facing guard fails, and revoke it before trying the next case.
  foreach v_role in array ARRAY['anon','authenticated'] loop
    foreach v_privilege in array ARRAY['INSERT','UPDATE','DELETE'] loop
      execute format('grant %s on public.xp_events to %I',v_privilege,v_role);
      failure_detected:=false;
      begin
        perform pg_temp.assert_no_client_table_writes();
      exception when others then
        if SQLERRM<>format(
          'CLIENT_WRITE_PRIVILEGE: %s on public.xp_events to %s',
          v_privilege,v_role
        ) then raise; end if;
        failure_detected:=true;
      end;
      if not failure_detected then
        raise exception 'ACL negative fixture did not reject % privilege for %',
          v_privilege,v_role;
      end if;
      execute format('revoke %s on public.xp_events from %I',v_privilege,v_role);
    end loop;
  end loop;
  perform pg_temp.assert_no_client_table_writes();
  raise notice 'PASS PG17: all six forbidden grants fail ACL guard, then restored';
end;
$negative_permissions$;

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
