\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 only. Never run against the hosted Supabase DB.
-- CI uses a loopback PostgreSQL service with disposable test credentials.
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
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610280002_casual_rooms.sql
\i supabase/migrations/202610290004_security_room_create_limits.sql

-- Test-only exception adapter: a failed creation rolls back its subtransaction
-- and reports the real RPC error to the caller without aborting the session.
create function public.test_room_creation(p_code text) returns text
language plpgsql security invoker set search_path = '' as $$
begin
  return public.create_casual_room(p_code)::text;
exception when others then
  return 'ERROR:' || SQLERRM;
end;
$$;
revoke all on function public.test_room_creation(text) from public, anon;
grant execute on function public.test_room_creation(text) to authenticated;

create function public.seed_room_limit_test(p_count int, p_closed boolean)
returns void language plpgsql as $$
declare v_room uuid;
begin
  truncate public.room_players, public.rooms cascade;
  for i in 1..p_count loop
    insert into public.rooms(code, owner_id, status)
    values ('ABCDEFG' || substr('HJKLMNPQRSTUV', i, 1),
      '11111111-1111-4111-8111-111111111111',
      case when p_closed then 'closed' else 'waiting' end)
    returning id into v_room;
    if not p_closed then
      insert into public.room_players(room_id, user_id, seat)
      values (v_room, '11111111-1111-4111-8111-111111111111', 1);
    end if;
  end loop;
end;
$$;

create function public.verify_room_race(p_expected_error text, p_total int, p_live int)
returns void language plpgsql as $$
declare
  v_conn text := 'host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
  v_actor text := '11111111-1111-4111-8111-111111111111';
  v_other text := '22222222-2222-4222-8222-222222222222';
  v_first text;
  v_second text;
  v_third text;
  v_pid int;
  v_blocked boolean := false;
  v_rooms int;
  v_open int;
  v_seats int;
begin
  perform dblink_connect('race_first', v_conn);
  perform dblink_connect('race_second', v_conn);
  perform dblink_connect('race_other', v_conn);

  perform dblink_exec('race_first', 'begin');
  perform dblink_exec('race_first', 'set local role authenticated');
  perform dblink_exec('race_first', format('set local request.jwt.claim.sub = %L', v_actor));
  select result into v_first from dblink('race_first',
    'select public.test_room_creation(''ABCDEFGW'')') as t(result text);
  if v_first !~ '^[0-9a-f-]{36}$' then
    raise exception 'First creation failed: %', v_first;
  end if;

  perform dblink_exec('race_second', 'begin');
  perform dblink_exec('race_second', 'set local role authenticated');
  perform dblink_exec('race_second', format('set local request.jwt.claim.sub = %L', v_actor));
  select pid into v_pid from dblink('race_second', 'select pg_backend_pid()') as t(pid int);
  perform dblink_send_query('race_second', 'select public.test_room_creation(''ABCDEFGX'')');
  for i in 1..100 loop
    select exists(select 1 from pg_stat_activity
      where pid = v_pid and wait_event_type = 'Lock') into v_blocked;
    exit when v_blocked;
    perform pg_sleep(0.05);
  end loop;
  if not v_blocked then
    raise exception 'Second PostgreSQL connection never waited for owner lock';
  end if;

  -- B must complete before A's first connection releases the profile lock.
  perform dblink_exec('race_other', 'begin');
  perform dblink_exec('race_other', 'set local role authenticated');
  perform dblink_exec('race_other', format('set local request.jwt.claim.sub = %L', v_other));
  perform dblink_exec('race_other', 'set local statement_timeout = 3000');
  select result into v_third from dblink('race_other',
    'select public.test_room_creation(''ABCDEFGZ'')') as t(result text);
  if v_third !~ '^[0-9a-f-]{36}$' then
    raise exception 'Different user could not create independently: %', v_third;
  end if;
  perform dblink_exec('race_other', 'commit');

  perform dblink_exec('race_first', 'commit');
  select result into v_second from dblink_get_result('race_second') as t(result text);
  if v_second is distinct from 'ERROR:' || p_expected_error then
    raise exception 'Expected % but second call returned %', p_expected_error, v_second;
  end if;
  perform dblink_exec('race_second', 'commit');

  select count(*), count(*) filter(where status = 'waiting' and expires_at > clock_timestamp())
  into v_rooms, v_open from public.rooms where owner_id = v_actor::uuid;
  select count(*) into v_seats from public.room_players rp
    join public.rooms r on r.id = rp.room_id where r.owner_id = v_actor::uuid;
  if (v_rooms, v_open, v_seats) is distinct from (p_total, p_live, p_live) then
    raise exception 'Unexpected rooms/live/seats: %/%/% (expected %/%/%)',
      v_rooms, v_open, v_seats, p_total, p_live, p_live;
  end if;
  if (select count(*) from public.rooms where owner_id = v_other::uuid) <> 1
    or (select count(*) from public.room_players rp join public.rooms r
        on r.id = rp.room_id where r.owner_id = v_other::uuid) <> 1 then
    raise exception 'Other user was blocked or room/seat state is inconsistent';
  end if;
  if exists(select 1 from public.room_players rp
    left join public.rooms r on r.id = rp.room_id where r.id is null) then
    raise exception 'An orphaned participant row remains';
  end if;
  perform dblink_disconnect('race_first');
  perform dblink_disconnect('race_second');
  perform dblink_disconnect('race_other');
  raise notice 'PASS: %, real lock wait, independent owner and no partial rows', p_expected_error;
end;
$$;

-- The seed transaction commits before new independent connections race.
select public.seed_room_limit_test(4, false);
select public.verify_room_race('ROOM_ACTIVE_LIMIT', 5, 5);
select public.seed_room_limit_test(9, true);
select public.verify_room_race('ROOM_RATE_LIMIT', 10, 1);
