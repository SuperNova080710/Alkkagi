\set ON_ERROR_STOP on
-- Execute ONLY inside the freshly restored disposable PG17 database.
-- Assert restored durable snapshot BEFORE adding any new records.
\echo 'R5: verify backup archive recovered the exact synthetic application state'
do $restored$
declare
  v_rls record;
begin
  if (select count(*) from auth.users)<>2
    or (select count(*) from public.profiles)<>2
    or (select count(*) from public.friend_links
      where status='accepted')<>1
    or (select count(*) from public.dm_threads)<>1
    or (select count(*) from public.dm_messages
      where body='DISPOSABLE_BACKUP_SENTINEL')<>1
    or (select count(*) from public.room_friend_invites
      where status='pending')<>1
    or (select count(*) from public.room_players rp
      join public.rooms r on r.id=rp.room_id
      where r.code='RBCDEFGH' and rp.seat=1)<>1
    or (select count(*) from public.xp_events
      where source_kind='ranked')<>4
    or (select total_xp from public.player_progress
      where user_id='11111111-1111-4111-8111-111111111111')<>140
    or (select total_xp from public.player_progress
      where user_id='22222222-2222-4222-8222-222222222222')<>70
    or (select count(*) from public.cosmetic_items
      where published)<>6
    or (select count(*) from public.player_cosmetic_loadouts
      where avatar_code='avatar-orbit')<>1
  then raise exception 'RESTORE_DATA_MISMATCH'; end if;

  for v_rls in
    select c.oid,c.relname,c.relrowsecurity
    from pg_catalog.pg_class c
    where c.oid in (
      'public.friend_links'::regclass,
      'public.dm_messages'::regclass,
      'public.room_friend_invites'::regclass,
      'public.xp_events'::regclass,
      'public.player_cosmetic_inventory'::regclass,
      'public.player_cosmetic_loadouts'::regclass
    )
  loop
    if not v_rls.relrowsecurity
      or pg_catalog.has_table_privilege('anon',v_rls.oid,'INSERT')
      or pg_catalog.has_table_privilege('authenticated',v_rls.oid,'UPDATE')
      or pg_catalog.has_table_privilege('authenticated',v_rls.oid,'DELETE')
    then raise exception 'RESTORE_RLS_OR_PRIVILEGES_LOST: %',v_rls.relname; end if;
  end loop;

  if pg_catalog.has_function_privilege('anon',
    'public.send_direct_message(uuid,text,uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated',
    'public.send_direct_message(uuid,text,uuid)','EXECUTE')
    or (select count(*) from pg_catalog.pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public'
        and tablename in ('dm_messages','dm_threads'))<>2
    or (select count(*) from pg_catalog.pg_trigger
      where not tgisinternal and tgenabled<>'D'
        and tgname in ('xp_pvp_match_finished','xp_ai_match_finished'))<>2
  then raise exception 'RESTORE_RPC_REALTIME_OR_TRIGGER_MISMATCH'; end if;
  raise notice 'PASS R5: backup restored rows, RLS, grants, RPCs, realtime publication and XP triggers';
end;
$restored$;

\echo 'R5: read through authenticated RLS after restore'
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $privacy$
begin
  if (select count(*) from public.xp_events
    where user_id='11111111-1111-4111-8111-111111111111')<>0
    or (select count(*) from public.player_cosmetic_inventory
      where user_id='11111111-1111-4111-8111-111111111111')<>0
    or (select count(*) from public.dm_messages)<>1
    or (select count(*) from public.friend_links where status='accepted')<>1
  then raise exception 'RESTORE_CROSS_ACCOUNT_RLS_FAILED'; end if;
  raise notice 'PASS R5: restored JWT identity restrictions still filter private XP/inventory';
end;
$privacy$;
commit;

\echo 'R5: verify restored RPCs, sequence values and invitation FK updates'
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $new_message$
declare v_result jsonb;
begin
  v_result:=public.send_direct_message(
    '11111111-1111-4111-8111-111111111111',
    'AFTER_RESTORE',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  );
  if (v_result->>'id')::bigint<=1
    or v_result->>'body'<>'AFTER_RESTORE'
    or v_result->>'alreadySent'<>'false' then
    raise exception 'RESTORE_DM_SEQUENCE_OR_RPC_INVALID'; end if;
  raise notice 'PASS R5: restored DM identity sequence continues without collision';
end;
$new_message$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $take_invite$
declare v_result jsonb; v_inbox jsonb; v_room jsonb;
begin
  -- Invitation table has NO authenticated SELECT grant by design.
  -- Use the authorized inbox RPC to discover the invitation ID.
  v_inbox:=public.list_received_room_invites();
  if jsonb_array_length(v_inbox)<>1 then
    raise exception 'RESTORE_INVITE_INBOX_MISSING'; end if;
  v_result:=public.respond_room_friend_invite(
    (v_inbox->0->>'id')::uuid,true
  );
  v_room:=public.get_casual_room((v_result->>'roomId')::uuid);
  if v_result->>'status'<>'accepted'
     or (v_room->>'yourSeat')::integer<>2 then
    raise exception 'RESTORE_INVITE_OR_ROOM_FK_FAILED'; end if;
  raise notice 'PASS R5: authorized inbox restored, invite accepted and seat2 assigned';
end;
$take_invite$;
commit;

\echo 'R5: verify auth.users insert trigger still creates profiles'
insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');
do $auth_trigger$
begin
  if not exists(select 1 from public.profiles
    where id='33333333-3333-4333-8333-333333333333') then
    raise exception 'RESTORE_AUTH_TRIGGER_MISSING'; end if;
  raise notice 'PASS R5: auth.users -> profiles trigger restored';
end;
$auth_trigger$;
\echo 'PASS R5: fully restored PostgreSQL 17 synthetic game state and security'
