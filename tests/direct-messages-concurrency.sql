\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 only. Never run against a hosted Supabase DB.
create extension dblink;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create publication supabase_realtime;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000011'),
  ('11111111-1111-4111-8111-111111111112');
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610280006_ranked_queue_and_rating.sql
\i supabase/migrations/202610280010_profile_nickname.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290005_friends_v1.sql
\i supabase/migrations/202610290006_direct_messages_v1.sql

insert into public.friend_links(requester_id,recipient_id,status)
values ('00000000-0000-4000-8000-000000000011',
  '11111111-1111-4111-8111-111111111112','accepted');

-- Wrapping the RPC in a subtransaction turns an expected domain error into
-- a testable value without aborting the independent sender connection.
create function public.test_dm_send(p_request_id uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  result := public.send_direct_message(
    '11111111-1111-4111-8111-111111111112',
    'from separate PostgreSQL connection',p_request_id);
  return 'OK:' || (result->>'id');
exception when others then
  return 'ERROR:' || SQLERRM;
end;
$$;
revoke all on function public.test_dm_send(uuid) from public,anon;
grant execute on function public.test_dm_send(uuid) to authenticated;

create function public.verify_dm_lock_wait() returns void
language plpgsql as $$
declare
  v_conn text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
  v_actor text:='00000000-0000-4000-8000-000000000011';
  v_start timestamptz;
  v_sender_pid int;
  v_waited boolean:=false;
  v_first text;
  v_second text;
  v_count int;
  v_saved_at timestamptz;
begin
  perform dblink_connect('dm_blocker',v_conn);
  perform dblink_connect('dm_sender',v_conn);

  perform dblink_exec('dm_blocker','begin');
  perform id from dblink('dm_blocker',format(
    'select id from public.profiles where id=%L::uuid for update',v_actor
  )) as t(id uuid);

  perform dblink_exec('dm_sender','begin');
  perform dblink_exec('dm_sender','set local role authenticated');
  perform dblink_exec('dm_sender',format(
    'set local request.jwt.claim.sub = %L',v_actor
  ));
  select pid into v_sender_pid from dblink('dm_sender','select pg_backend_pid()') as t(pid int);
  v_start:=clock_timestamp();
  perform dblink_send_query('dm_sender',
    'select public.test_dm_send(''77777777-7777-4777-8777-777777777791''::uuid)');
  -- Force the transaction to remain open for >1 second while the RPC waits.
  perform pg_sleep(1.25);
  select exists(select 1 from pg_stat_activity
    where pid=v_sender_pid and wait_event_type='Lock') into v_waited;
  if not v_waited then raise exception 'Sender did not wait on the user row lock'; end if;

  perform dblink_exec('dm_blocker','commit');
  select result into v_first from dblink_get_result('dm_sender') as t(result text);
  perform result from dblink_get_result('dm_sender') as t(result text);
  if v_first not like 'OK:%' then raise exception 'Initial DM failed: %',v_first; end if;
  perform dblink_exec('dm_sender','commit');

  -- The sender must be throttled immediately after committing the first DM,
  -- regardless of when its transaction originally began.
  perform dblink_exec('dm_sender','begin');
  perform dblink_exec('dm_sender','set local role authenticated');
  perform dblink_exec('dm_sender',format('set local request.jwt.claim.sub = %L',v_actor));
  select result into v_second from dblink('dm_sender',
    'select public.test_dm_send(''77777777-7777-4777-8777-777777777792''::uuid)')
    as t(result text);
  perform dblink_exec('dm_sender','commit');
  if v_second is distinct from 'ERROR:DM_RATE_LIMIT' then
    raise exception 'Post-wait retry bypassed DM_RATE_LIMIT: %',v_second;
  end if;

  select count(*),max(created_at) into v_count,v_saved_at
    from public.dm_messages
    where sender_id=v_actor::uuid;
  if v_count <> 1 or v_saved_at < v_start + interval '1 second' then
    raise exception 'Stored message timestamp predates lock wait (count %, created_at %, started %)',
      v_count,v_saved_at,v_start;
  end if;

  perform dblink_disconnect('dm_sender');
  perform dblink_disconnect('dm_blocker');
  raise notice 'PASS: independent connections, lock wait, post-wait timestamp, DM_RATE_LIMIT and no extra message';
end;
$$;

select public.verify_dm_lock_wait();
