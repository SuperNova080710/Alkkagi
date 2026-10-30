\set ON_ERROR_STOP on
-- Disposable PG17 source database ONLY. The base migration/XP integration
-- fixture has already created two invented auth identities and 004-009 tables.
\echo 'R5: insert synthetic friendship, DM and pending friend-room invitation'
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.send_friend_request('22222222-2222-4222-8222-222222222222');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.respond_friend_request(
  (select id from public.friend_links limit 1),true
);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.send_direct_message(
  '22222222-2222-4222-8222-222222222222',
  'DISPOSABLE_BACKUP_SENTINEL',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
commit;

-- The R3 PG17 fixture has created 10 closed rooms owned by user A.
-- User B has no created rooms yet and can create a fresh invitation room.
begin;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.create_casual_room('RBCDEFGH');
select public.send_room_friend_invite(
  (select id from public.rooms where code='RBCDEFGH'),
  '11111111-1111-4111-8111-111111111111'
);
commit;

\echo 'R5: assert expected synthetic source snapshot before pg_dump'
do $source$
begin
  if (select count(*) from auth.users)<>2
     or (select count(*) from public.profiles)<>2
     or (select count(*) from public.friend_links where status='accepted')<>1
     or (select count(*) from public.dm_threads)<>1
     or (select count(*) from public.dm_messages
         where body='DISPOSABLE_BACKUP_SENTINEL')<>1
     or (select count(*) from public.room_friend_invites
         where status='pending')<>1
     or (select count(*) from public.rooms where code='RBCDEFGH'
         and status='waiting')<>1
     or (select count(*) from public.xp_events)<>4
     or (select count(*) from public.player_progress)<>2
     or (select count(*) from public.cosmetic_items where published)<>6
     or (select count(*) from public.player_cosmetic_loadouts
         where avatar_code='avatar-orbit')<>1
  then raise exception 'Backup source fixture not complete'; end if;
  raise notice 'PASS R5: source snapshot includes auth/users, friend, DM, invite, XP and loadout';
end;
$source$;
