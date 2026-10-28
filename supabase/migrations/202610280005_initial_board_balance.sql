begin;
-- Align the FIRST match with the new rematch board and capped force.
create or replace function public.start_casual_match(p_room_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_guest uuid;
  v_id uuid;
  v_pieces jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.owner_id <> v_actor then raise exception 'NOT_HOST'; end if;
  if v_room.status <> 'waiting' or v_room.expires_at <= now() then raise exception 'ROOM_UNAVAILABLE'; end if;
  select user_id into v_guest from public.room_players where room_id=p_room_id and seat=2;
  if v_guest is null then raise exception 'NEED_TWO_PLAYERS'; end if;
  if not exists(select 1 from public.room_players where room_id=p_room_id and user_id=v_actor and seat=1)
    then raise exception 'INVALID_HOST_SEAT'; end if;
  select jsonb_agg(jsonb_build_object('id',piece_id,'owner',owner,'x',x,'y',y) order by piece_id)
    into v_pieces from (
      select 'a'||n as piece_id, v_actor as owner, 175::float8 as x,
        (70+n*60)::float8 as y from generate_series(1,5) n
      union all
      select 'b'||n as piece_id, v_guest as owner, 625::float8 as x,
        (70+n*60)::float8 as y from generate_series(1,5) n
    ) board;
  insert into public.matches(room_id,player1_id,player2_id,turn_user_id,board_state)
    values(p_room_id,v_actor,v_guest,v_actor,jsonb_build_object('pieces',v_pieces))
    returning id into v_id;
  update public.rooms set status='playing' where id=p_room_id;
  return v_id;
end;
$$;
revoke all on function public.start_casual_match(uuid) from public,anon;
grant execute on function public.start_casual_match(uuid) to authenticated;
commit;
