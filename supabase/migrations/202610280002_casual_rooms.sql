begin;
-- Dedicated room RPCs are authenticated-only; direct table writes stay forbidden.
create function public.create_casual_room(p_code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'INVALID_CODE'; end if;
  if not exists (select 1 from public.profiles where id=v_user) then raise exception 'PROFILE_MISSING'; end if;
  insert into public.rooms(code,owner_id) values (p_code,v_user) returning id into v_id;
  insert into public.room_players(room_id,user_id,seat) values(v_id,v_user,1);
  return v_id;
end;
$$;
create function public.join_casual_room(p_code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_room public.rooms%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'INVALID_CODE'; end if;
  select * into v_room from public.rooms where code=p_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if exists(select 1 from public.room_players where room_id=v_room.id and user_id=v_user)
    then return v_room.id; end if;
  if v_room.status <> 'waiting' or v_room.expires_at<=now() then
    raise exception 'ROOM_UNAVAILABLE'; end if;
  if exists(select 1 from public.room_players where room_id=v_room.id and seat=2)
    then raise exception 'ROOM_FULL'; end if;
  insert into public.room_players(room_id,user_id,seat) values(v_room.id,v_user,2);
  return v_room.id;
end;
$$;
create function public.leave_casual_room(p_room_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_room public.rooms%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where id=p_room_id for update;
  if not found or not exists(select 1 from public.room_players where room_id=p_room_id and user_id=v_user) then
    raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_STARTED'; end if;
  if v_room.owner_id=v_user then
    update public.rooms set status='closed' where id=p_room_id;
    delete from public.room_players where room_id=p_room_id;
  else
    delete from public.room_players where room_id=p_room_id and user_id=v_user;
  end if;
  return true;
end;
$$;
create function public.get_casual_room(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.room_players where room_id=p_room_id and user_id=v_user) then
    raise exception 'ROOM_NOT_FOUND'; end if;
  select jsonb_build_object('id',r.id,'code',r.code,'status',r.status,
    'yourSeat',(select rp.seat from public.room_players rp where rp.room_id=r.id and rp.user_id=v_user),
    'players',coalesce((select jsonb_agg(jsonb_build_object('seat',rp.seat,'nickname',p.nickname) order by rp.seat)
      from public.room_players rp join public.profiles p on p.id=rp.user_id where rp.room_id=r.id),'[]'::jsonb))
  into v_result from public.rooms r where r.id=p_room_id;
  return v_result;
end;
$$;
revoke all on function public.create_casual_room(text) from public,anon;
revoke all on function public.join_casual_room(text) from public,anon;
revoke all on function public.leave_casual_room(uuid) from public,anon;
revoke all on function public.get_casual_room(uuid) from public,anon;
grant execute on function public.create_casual_room(text) to authenticated;
grant execute on function public.join_casual_room(text) to authenticated;
grant execute on function public.leave_casual_room(uuid) to authenticated;
grant execute on function public.get_casual_room(uuid) to authenticated;
commit;