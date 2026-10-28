begin;

-- Atomic match start; no client-controlled initial board.
create function public.start_casual_match(p_room_id uuid)
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
      select 'a'||n as piece_id, v_actor as owner, 110::float8 as x,
        (70+n*60)::float8 as y from generate_series(1,5) n
      union all
      select 'b'||n as piece_id, v_guest as owner, 690::float8 as x,
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

-- These two functions are NEVER available to clients; server-only key required.
-- Next.js verifies the bearer/cookie through Supabase Auth and passes verified user.id.
create function public.commit_casual_shot(
  p_match_id uuid, p_actor uuid, p_turn integer, p_request uuid,
  p_piece text, p_input jsonb, p_result jsonb, p_winner uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_match public.matches%rowtype; v_finished boolean; v_next_user uuid; v_new jsonb;
begin
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if p_actor not in (v_match.player1_id,v_match.player2_id) then raise exception 'NOT_PARTICIPANT'; end if;
  if v_match.status <> 'active' then raise exception 'MATCH_FINISHED'; end if;
  if v_match.turn_no <> p_turn or v_match.turn_user_id <> p_actor then raise exception 'STALE_TURN'; end if;
  if exists(select 1 from public.shots where match_id=p_match_id and request_id=p_request)
    then raise exception 'DUPLICATE_REQUEST'; end if;
  if not exists(select 1 from jsonb_array_elements(v_match.board_state->'pieces') p
      where p->>'id'=p_piece and p->>'owner'=p_actor::text) then raise exception 'NOT_YOUR_PIECE'; end if;
  if p_winner is not null and p_winner not in (v_match.player1_id,v_match.player2_id)
    then raise exception 'INVALID_WINNER'; end if;
  if jsonb_typeof(p_result->'pieces') <> 'array' then raise exception 'INVALID_BOARD'; end if;
  -- Ensure the computed result starts from the same snapshot the server read.
  if p_input->'expectedBoard' is distinct from v_match.board_state then raise exception 'STALE_BOARD'; end if;
  v_finished := p_input->>'finished'='true';
  if v_finished is false and p_winner is not null then raise exception 'INVALID_WINNER'; end if;
  v_next_user := case when p_actor=v_match.player1_id then v_match.player2_id else v_match.player1_id end;
  update public.matches set
    board_state=p_result,
    turn_no=turn_no+1,turn_user_id=v_next_user,
    status=case when v_finished then 'finished' else 'active' end,
    winner_id=case when v_finished then p_winner else null end,
    finished_at=case when v_finished then now() else null end
    where id=p_match_id;
  insert into public.shots(match_id,turn_no,request_id,player_id,piece_id,input,result_state)
    values(p_match_id,p_turn,p_request,p_actor,p_piece,p_input,p_result);
  select jsonb_build_object('id',id,'status',status,'turnNo',turn_no,'turnUserId',turn_user_id,
    'winnerId',winner_id,'boardState',board_state) into v_new
    from public.matches where id=p_match_id;
  return v_new;
end;
$$;

create function public.forfeit_casual_match(p_match_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_match public.matches%rowtype; v_winner uuid;
begin
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if p_actor not in (v_match.player1_id,v_match.player2_id) then raise exception 'NOT_PARTICIPANT'; end if;
  if v_match.status <> 'active' then raise exception 'MATCH_FINISHED'; end if;
  v_winner:=case when p_actor=v_match.player1_id then v_match.player2_id else v_match.player1_id end;
  update public.matches set status='finished',winner_id=v_winner,finished_at=now() where id=p_match_id;
  return jsonb_build_object('winnerId',v_winner);
end;
$$;

revoke all on function public.commit_casual_shot(uuid,uuid,integer,uuid,text,jsonb,jsonb,uuid)
  from public,anon,authenticated;
revoke all on function public.forfeit_casual_match(uuid,uuid) from public,anon,authenticated;
grant execute on function public.commit_casual_shot(uuid,uuid,integer,uuid,text,jsonb,jsonb,uuid) to service_role;
grant execute on function public.forfeit_casual_match(uuid,uuid) to service_role;

-- Database is authoritative; notification loss is handled by snapshot polling.
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
commit;
