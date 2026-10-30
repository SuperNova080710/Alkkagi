\set ON_ERROR_STOP on
-- Runs only inside disposable PostgreSQL 16 GitHub Actions service.
create extension dblink;
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
  ('22222222-2222-4222-8222-222222222222');
\i supabase/migrations/202610280001_initial_schema.sql
\i supabase/migrations/202610280006_ranked_queue_and_rating.sql
\i supabase/migrations/202610290003_player_profile_discovery.sql
\i supabase/migrations/202610290009_cosmetics_v1.sql
update public.profiles set ranked_wins=3
where id='11111111-1111-4111-8111-111111111111';

create function public.verify_cosmetic_race() returns void
language plpgsql as $cosrace$
declare
 v_conn text:='host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres';
 v_a text:='11111111-1111-4111-8111-111111111111';
 v_b text:='22222222-2222-4222-8222-222222222222';
 v_pid int;
 v_waiting boolean:=false;
 v_value text;
 v_public text;
begin
 perform dblink_connect('equip_first',v_conn);
 perform dblink_connect('equip_second',v_conn);
 perform dblink_connect('equip_other',v_conn);

 perform dblink_exec('equip_first','begin');
 perform dblink_exec('equip_first','set local role authenticated');
 perform dblink_exec('equip_first',format('set local request.jwt.claim.sub = %L',v_a));
 select result into v_value from dblink('equip_first',
   'select public.equip_my_cosmetic(''piece-forest'')::text') as t(result text);
 if v_value not like '%piece-forest%' then raise exception 'Initial equip failed: %',v_value; end if;

 perform dblink_exec('equip_second','begin');
 perform dblink_exec('equip_second','set local role authenticated');
 perform dblink_exec('equip_second','set local statement_timeout = 4000');
 perform dblink_exec('equip_second',format('set local request.jwt.claim.sub = %L',v_a));
 select pid into v_pid from dblink('equip_second','select pg_backend_pid()') as t(pid int);
 perform dblink_send_query('equip_second',
   'select public.equip_my_cosmetic(''piece-classic'')::text');
 for i in 1..100 loop
   select exists(select 1 from pg_stat_activity
     where pid=v_pid and wait_event_type='Lock') into v_waiting;
   exit when v_waiting;
   perform pg_sleep(0.025);
 end loop;
 if not v_waiting then
   raise exception 'Concurrent equip did not wait for same-user profile lock';
 end if;

 -- Different users can equip while A's transaction holds its lock.
 perform dblink_exec('equip_other','begin');
 perform dblink_exec('equip_other','set local role authenticated');
 perform dblink_exec('equip_other','set local statement_timeout = 3000');
 perform dblink_exec('equip_other',format('set local request.jwt.claim.sub = %L',v_b));
 select result into v_value from dblink('equip_other',
   'select public.equip_my_cosmetic(''avatar-classic'')::text') as t(result text);
 if v_value not like '%avatar-classic%' then
   raise exception 'Other user equip did not finish independently: %',v_value;
 end if;
 perform dblink_exec('equip_other','commit');
 perform dblink_exec('equip_first','commit');
 select result into v_value from dblink_get_result('equip_second') as t(result text);
 perform result from dblink_get_result('equip_second') as t(result text);
 perform dblink_exec('equip_second','commit');
 if v_value not like '%piece-classic%' then
   raise exception 'Second equip did not replace first: %',v_value;
 end if;

 if (select piece_code from public.player_cosmetic_loadouts
     where user_id=v_a::uuid)<>'piece-classic'
   or (select count(*) from public.player_cosmetic_inventory
     where user_id=v_a::uuid and item_code='piece-forest')<>1
   or (select count(*) from public.player_cosmetic_loadouts
     where user_id=v_a::uuid)<>1 then
   raise exception 'Concurrent equip left invalid loadout or inventory';
 end if;
 raise notice 'PASS: same-user equip serialized, different-user unaffected, one loadout and owned item';

 -- Re-equip a published item, unpublish it, and query from other user's session.
 perform dblink_exec('equip_first','begin');
 perform dblink_exec('equip_first','set local role authenticated');
 perform dblink_exec('equip_first',format('set local request.jwt.claim.sub = %L',v_a));
 perform result from dblink('equip_first',
   'select public.equip_my_cosmetic(''piece-forest'')::text') as t(result text);
 perform dblink_exec('equip_first','commit');
 -- Commit the moderator's change in an independent admin session before
 -- another connection reads it; the enclosing verification function is a
 -- single transaction and its own uncommitted UPDATE would be invisible.
 perform dblink_exec('equip_first',
   'update public.cosmetic_items set published=false where code=''piece-forest''');
 perform dblink_exec('equip_other','begin');
 perform dblink_exec('equip_other','set local role authenticated');
 perform dblink_exec('equip_other',format('set local request.jwt.claim.sub = %L',v_b));
 select result into v_public from dblink('equip_other',
   format('select public.get_public_player_cosmetics(%L::uuid)::text',v_a))
   as t(result text);
 perform dblink_exec('equip_other','commit');
 if v_public like '%piece-forest%' or v_public not like '%piece-classic%' then
   raise exception 'Unpublished item code leaked through public RPC: %',v_public;
 end if;
 if (select piece_code from public.player_cosmetic_loadouts
     where user_id=v_a::uuid)<>'piece-forest' then
   raise exception 'Unpublish unexpectedly altered stored equipment';
 end if;
 perform dblink_exec('equip_first',
   'update public.cosmetic_items set published=true where code=''piece-forest''');
 perform dblink_disconnect('equip_other');
 perform dblink_disconnect('equip_second');
 perform dblink_disconnect('equip_first');
 raise notice 'PASS: published toggle masks public equipped item without changing DB choice';
end;
$cosrace$;

select public.verify_cosmetic_race();
