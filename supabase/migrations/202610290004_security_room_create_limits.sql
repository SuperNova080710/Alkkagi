begin;

-- Security S1 (#63): This public RPC can be called directly by every signed-in
-- user, not only through the room creation UI. Limit database writes at source.
-- Serialize all creations by an owner using their existing profile row lock.
-- No new state, profile data mutation, RLS grant, or function signature change.
create or replace function public.create_casual_room(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_active integer;
  v_recent integer;
  v_checked_at timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'INVALID_CODE';
  end if;

  -- A per-owner row lock also protects the limit against parallel transactions.
  -- Lock before counting, and use a fresh wall clock after any lock wait.
  perform 1 from public.profiles where id = v_user for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  v_checked_at := clock_timestamp();

  select count(*) into v_active
  from public.rooms
  where owner_id = v_user
    and status = 'waiting'
    and expires_at > v_checked_at;
  if v_active >= 5 then raise exception 'ROOM_ACTIVE_LIMIT'; end if;

  -- Count all creation attempts that succeeded in the rolling window, even
  -- when their rooms were later closed or started as AI/casual matches.
  select count(*) into v_recent
  from public.rooms
  where owner_id = v_user
    and created_at > v_checked_at - interval '10 minutes';
  if v_recent >= 10 then raise exception 'ROOM_RATE_LIMIT'; end if;

  insert into public.rooms(code, owner_id)
  values (p_code, v_user) returning id into v_id;
  insert into public.room_players(room_id, user_id, seat)
  values (v_id, v_user, 1);
  return v_id;
end;
$$;

-- Preserve the original API contract: authenticated only, no anonymous call
-- and no direct table writes. Admin-only game settlement RPCs are unchanged.
revoke all on function public.create_casual_room(text)
  from public, anon, authenticated;
grant execute on function public.create_casual_room(text) to authenticated;

comment on function public.create_casual_room(text) is
  'Authenticated room creation, limited to 5 unexpired waiting rooms and 10 creations per 10 minutes per owner.';

commit;
