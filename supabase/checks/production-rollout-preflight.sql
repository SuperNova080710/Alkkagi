-- Read-only Production rollout preflight (#155/#156).
-- Run via Supabase SQL Editor with a read-only administrative session.
-- Every statement in this file is SELECT: no migrations, DDL, DML, secrets,
-- auth user data or application rows are read or modified.
--
-- States:
--  ready    = existing prerequisite or expected object/permission is correct
--  pending  = object expected in future migration is not installed
--  blocked  = existing object violates expected RLS/ACL/trigger/publication
--  inspect  = existing 004 RPC; runtime limiter behavior NOT independently certified
-- A "ready" report is NOT proof of migration-history integrity.

with expected_objects(stage,kind,identifier) as (
  values
    ('base','table','public.profiles'),
    ('base','table','public.rooms'),
    ('base','table','public.room_players'),
    ('base','table','public.matches'),
    ('base','table','public.ai_matches'),
    ('base','table','public.player_profile_settings'),
    ('base','publication','supabase_realtime'),
    ('004','rpc-limiter','public.create_casual_room(text)'),
    ('005','table','public.friend_links'),
    ('005','table','public.player_blocks'),
    ('005','rpc','public.send_friend_request(uuid)'),
    ('005','rpc','public.respond_friend_request(uuid,boolean)'),
    ('005','rpc','public.remove_friend(uuid)'),
    ('005','rpc','public.set_player_block(uuid,boolean)'),
    ('005','rpc','public.get_friend_overview()'),
    ('006','table','public.dm_threads'),
    ('006','table','public.dm_messages'),
    ('006','table','public.dm_read_state'),
    ('006','rpc','public.send_direct_message(uuid,text,uuid)'),
    ('006','rpc','public.get_direct_messages(uuid,bigint,integer)'),
    ('006','rpc','public.mark_direct_messages_read(uuid,bigint)'),
    ('006','rpc','public.get_direct_message_inbox()'),
    ('007','table','public.room_friend_invites'),
    ('007','rpc','public.send_room_friend_invite(uuid,uuid)'),
    ('007','rpc','public.list_received_room_invites()'),
    ('007','rpc','public.list_sent_room_invites(uuid)'),
    ('007','rpc','public.respond_room_friend_invite(uuid,boolean)'),
    ('008','table','public.player_progress'),
    ('008','table','public.xp_events'),
    ('008','rpc','public.get_player_experience(uuid)'),
    ('009','table','public.cosmetic_items'),
    ('009','table','public.player_cosmetic_inventory'),
    ('009','table','public.player_cosmetic_loadouts'),
    ('009','rpc','public.get_my_cosmetics()'),
    ('009','rpc','public.equip_my_cosmetic(text)'),
    ('009','rpc','public.get_public_player_cosmetics(uuid)')
), evaluated as (
  select o.stage,o.kind,o.identifier,
    case
      when o.kind='table' then to_regclass(o.identifier) is not null
      when o.kind in ('rpc','rpc-limiter') then to_regprocedure(o.identifier) is not null
      when o.kind='publication' then exists(
        select 1 from pg_catalog.pg_publication p where p.pubname=o.identifier)
      else false
    end as exists_now
  from expected_objects o
)
select 'object'::text as category,e.stage,e.identifier as check_key,
  -- Never mark room-create throttling "ready" by matching exception
  -- strings in pg_proc.prosrc: dead code/comments can spoof those markers.
  -- Inspection of the actual 004 definition and independently reproduced
  -- rate/active-room limits is a mandatory release gate.
  case when e.stage='004' and e.exists_now then 'inspect'
  when e.exists_now then 'ready'
  when e.stage='base' then 'blocked' else 'pending' end as status
from evaluated e

union all

select 'table-access',x.stage,x.identifier,
  case when c.oid is null then 'pending'
       when not c.relrowsecurity then 'blocked'
       when pg_catalog.has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE')
         or pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')
         then 'blocked'
       else 'ready' end
from (values
  ('005','public.friend_links'),('005','public.player_blocks'),
  ('006','public.dm_threads'),('006','public.dm_messages'),('006','public.dm_read_state'),
  ('007','public.room_friend_invites'),
  ('008','public.player_progress'),('008','public.xp_events'),
  ('009','public.cosmetic_items'),('009','public.player_cosmetic_inventory'),
  ('009','public.player_cosmetic_loadouts')
) x(stage,identifier)
left join pg_catalog.pg_class c on c.oid=to_regclass(x.identifier)

union all

select 'rpc-access',e.stage,e.identifier,
  case when p.oid is null then 'pending'
       when pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
         or not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
         then 'blocked'
       else 'ready' end
from evaluated e
left join pg_catalog.pg_proc p on p.oid=to_regprocedure(e.identifier)
where e.kind='rpc'

union all

select 'trigger','008',t.target,
  case when exists (
    select 1 from pg_catalog.pg_trigger g
    where g.tgname=t.trigger_name
      and g.tgrelid=to_regclass(t.table_name)
      and not g.tgisinternal and g.tgenabled<>'D'
  ) then 'ready' else 'pending' end
from (values
  ('public.matches','xp_pvp_match_finished','public.matches/xp_pvp_match_finished'),
  ('public.ai_matches','xp_ai_match_finished','public.ai_matches/xp_ai_match_finished')
) t(table_name,trigger_name,target)

union all

select 'realtime','006','supabase_realtime/'||x.table_name,
  case when exists(
    select 1 from pg_catalog.pg_publication_tables pt
    where pt.pubname='supabase_realtime' and pt.schemaname='public'
      and pt.tablename=x.table_name
  ) then 'ready' else 'pending' end
from (values ('dm_threads'),('dm_messages')) x(table_name)

order by stage,category,check_key;
