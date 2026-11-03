begin;

-- v0.3.0 Omok casual core (#220); deliberately isolated from Alkkagi tables.
-- Applied only after reviewed release migration; NEVER run against production here.
create table public.omok_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  owner_id uuid not null references public.profiles(id),
  status text not null default 'waiting' check(status in ('waiting','playing','closed')),
  expires_at timestamptz not null default(now()+interval '30 minutes'),
  created_at timestamptz not null default now(),
  check(expires_at>created_at)
);
create index omok_rooms_owner_idx on public.omok_rooms(owner_id,created_at desc);

create table public.omok_room_players (
  room_id uuid not null references public.omok_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  seat smallint not null check(seat in(1,2)),
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id),
  unique(room_id,seat)
);
create index omok_room_players_user_idx on public.omok_room_players(user_id);

create table public.omok_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.omok_rooms(id),
  black_id uuid not null references public.profiles(id),
  white_id uuid not null references public.profiles(id),
  turn_user_id uuid not null references public.profiles(id),
  turn_no integer not null default 1 check(turn_no between 1 and 226),
  board_state jsonb not null check(jsonb_typeof(board_state)='array' and jsonb_array_length(board_state)=15),
  status text not null default 'active' check(status in('active','finished')),
  winner_id uuid references public.profiles(id),
  finish_reason text check(finish_reason in('five','draw','forfeit')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check(black_id<>white_id),
  check(turn_user_id in(black_id,white_id)),
  check(winner_id is null or winner_id in(black_id,white_id)),
  check(
    (status='active' and winner_id is null and finished_at is null and finish_reason is null)
    or (status='finished' and finished_at is not null and finish_reason is not null)
  ),
  check(finish_reason is distinct from 'draw' or winner_id is null)
);
create unique index omok_one_active_match_per_room on public.omok_matches(room_id)
  where status='active';
create index omok_matches_black_idx on public.omok_matches(black_id,created_at desc);
create index omok_matches_white_idx on public.omok_matches(white_id,created_at desc);

create table public.omok_moves (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.omok_matches(id) on delete cascade,
  turn_no integer not null check(turn_no between 1 and 225),
  request_id uuid not null,
  player_id uuid not null references public.profiles(id),
  stone text not null check(stone in('black','white')),
  row_no smallint not null check(row_no between 0 and 14),
  col_no smallint not null check(col_no between 0 and 14),
  created_at timestamptz not null default now(),
  unique(match_id,turn_no),
  unique(match_id,request_id),
  unique(match_id,row_no,col_no)
);
create index omok_moves_recent_idx on public.omok_moves(match_id,turn_no desc);

alter table public.omok_rooms enable row level security;
alter table public.omok_room_players enable row level security;
alter table public.omok_matches enable row level security;
alter table public.omok_moves enable row level security;

revoke all on public.omok_rooms,public.omok_room_players,public.omok_matches,public.omok_moves
  from public,anon,authenticated;
grant select on public.omok_rooms,public.omok_room_players,public.omok_matches,public.omok_moves
  to authenticated;
grant all on public.omok_rooms,public.omok_room_players,public.omok_matches,public.omok_moves
  to service_role;
revoke all on sequence public.omok_moves_id_seq from public,anon,authenticated;
grant usage,select on sequence public.omok_moves_id_seq to service_role;

create policy omok_rooms_member_read on public.omok_rooms for select to authenticated
using(exists(select 1 from public.omok_room_players rp
  where rp.room_id=omok_rooms.id and rp.user_id=(select auth.uid())));
create policy omok_room_players_self_read on public.omok_room_players for select to authenticated
using(user_id=(select auth.uid()));
create policy omok_matches_participant_read on public.omok_matches for select to authenticated
using((select auth.uid()) in(black_id,white_id));
create policy omok_moves_participant_read on public.omok_moves for select to authenticated
using(exists(select 1 from public.omok_matches m
  where m.id=omok_moves.match_id and (select auth.uid()) in(m.black_id,m.white_id)));

-- All writes are transactional SECURITY DEFINER RPCs with an explicit auth.uid()
-- and small, reviewed execution surface. Nothing accepts a client board/winner.
create function public.create_omok_room(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room_id uuid; checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'INVALID_CODE'; end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  checked_at:=clock_timestamp();
  if (select count(*) from public.omok_rooms
      where owner_id=actor and status='waiting' and expires_at>checked_at)>=5 then
    raise exception 'ROOM_ACTIVE_LIMIT'; end if;
  if (select count(*) from public.omok_rooms
      where owner_id=actor and created_at>checked_at-interval '10 minutes')>=10 then
    raise exception 'ROOM_RATE_LIMIT'; end if;
  insert into public.omok_rooms(code,owner_id) values(p_code,actor) returning id into room_id;
  insert into public.omok_room_players(room_id,user_id,seat) values(room_id,actor,1);
  return room_id;
end;
$$;

create function public.join_omok_room(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room public.omok_rooms%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'INVALID_CODE'; end if;
  select * into room from public.omok_rooms where code=p_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if exists(select 1 from public.omok_room_players
    where room_id=room.id and user_id=actor) then return room.id; end if;
  if room.status<>'waiting' or room.expires_at<=clock_timestamp() then
    raise exception 'ROOM_UNAVAILABLE'; end if;
  if exists(select 1 from public.omok_room_players
    where room_id=room.id and seat=2) then raise exception 'ROOM_FULL'; end if;
  if not exists(select 1 from public.profiles where id=actor) then
    raise exception 'PROFILE_MISSING'; end if;
  insert into public.omok_room_players(room_id,user_id,seat) values(room.id,actor,2);
  return room.id;
end;
$$;

create function public.get_omok_room(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.omok_room_players rp
    where rp.room_id=p_room_id and rp.user_id=actor) then raise exception 'ROOM_NOT_FOUND'; end if;
  select jsonb_build_object('id',r.id,'code',r.code,'status',r.status,
    'yourSeat',(select rp.seat from public.omok_room_players rp
      where rp.room_id=r.id and rp.user_id=actor),
    'players',coalesce((select jsonb_agg(jsonb_build_object(
      'seat',rp.seat,'userId',rp.user_id,'nickname',p.nickname) order by rp.seat)
      from public.omok_room_players rp join public.profiles p on p.id=rp.user_id
      where rp.room_id=r.id),'[]'::jsonb),
    'matchId',(select m.id from public.omok_matches m where m.room_id=r.id
      order by m.created_at desc,m.id desc limit 1)
  ) into result from public.omok_rooms r where r.id=p_room_id;
  return result;
end;
$$;

create function public.leave_omok_room(p_room_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room public.omok_rooms%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into room from public.omok_rooms where id=p_room_id for update;
  if not found or not exists(select 1 from public.omok_room_players
    where room_id=p_room_id and user_id=actor) then raise exception 'ROOM_NOT_FOUND'; end if;
  if room.status<>'waiting' then raise exception 'ROOM_STARTED'; end if;
  if room.owner_id=actor then
    update public.omok_rooms set status='closed' where id=p_room_id;
    delete from public.omok_room_players where room_id=p_room_id;
  else
    delete from public.omok_room_players where room_id=p_room_id and user_id=actor;
  end if;
  return true;
end;
$$;

create function public.start_omok_match(p_room_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room public.omok_rooms%rowtype; guest uuid; match_id uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into room from public.omok_rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if actor<>room.owner_id then raise exception 'NOT_HOST'; end if;
  if room.status<>'waiting' or room.expires_at<=clock_timestamp() then
    raise exception 'ROOM_UNAVAILABLE'; end if;
  if not exists(select 1 from public.omok_room_players where
    room_id=p_room_id and user_id=actor and seat=1) then
    raise exception 'INVALID_HOST_SEAT'; end if;
  select user_id into guest from public.omok_room_players
    where room_id=p_room_id and seat=2;
  if guest is null then raise exception 'NEED_TWO_PLAYERS'; end if;
  if exists(select 1 from public.omok_matches where room_id=p_room_id) then
    raise exception 'MATCH_ALREADY_STARTED'; end if;
  insert into public.omok_matches(room_id,black_id,white_id,turn_user_id,board_state)
    values(p_room_id,actor,guest,actor,to_jsonb(array_fill(null::text,array[15,15])))
    returning id into match_id;
  -- This is intentionally the first match only. #221 extends the same room
  -- with vote_omok_rematch() after a finished game; no waiting reset here.
  update public.omok_rooms set status='playing' where id=p_room_id;
  return match_id;
end;
$$;

-- Atomic and authoritative: only the current authenticated participant can place.
create function public.play_omok_move(
  p_match_id uuid,p_request_id uuid,p_turn integer,p_row integer,p_col integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  game public.omok_matches%rowtype;
  previous public.omok_moves%rowtype;
  stone text;
  next_board jsonb;
  won boolean:=false;
  finished boolean;
  count_line integer;
  step_r integer; step_c integer;
  r integer; c integer;
  dr integer; dc integer; direction integer; sign_step integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into game from public.omok_matches where id=p_match_id for update;
  if not found or actor not in(game.black_id,game.white_id) then
    raise exception 'MATCH_NOT_FOUND'; end if;
  select * into previous from public.omok_moves
    where match_id=p_match_id and request_id=p_request_id;
  if found then
    if previous.player_id<>actor or previous.turn_no<>p_turn or
       previous.row_no<>p_row or previous.col_no<>p_col then
      raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',game.id,'status',game.status,'turnNo',game.turn_no,
      'turnUserId',game.turn_user_id,'winnerId',game.winner_id,'finishReason',game.finish_reason,
      'boardState',game.board_state,'replayed',true);
  end if;
  if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
  if game.turn_user_id<>actor or game.turn_no<>p_turn then
    raise exception 'STALE_TURN'; end if;
  if p_row is null or p_col is null or p_row not between 0 and 14 or
      p_col not between 0 and 14 then raise exception 'INVALID_MOVE'; end if;
  if game.board_state #>> array[p_row::text,p_col::text] is not null then
    raise exception 'CELL_OCCUPIED'; end if;
  stone:=case when actor=game.black_id then 'black' else 'white' end;
  next_board:=jsonb_set(game.board_state,array[p_row::text,p_col::text],to_jsonb(stone),false);

  -- Count contiguous stones on both sides of every axis.
  for direction in 1..4 loop
    dr:=case direction when 1 then 0 when 2 then 1 when 3 then 1 else 1 end;
    dc:=case direction when 1 then 1 when 2 then 0 when 3 then 1 else -1 end;
    count_line:=1;
    for sign_step in -1..1 loop
      if sign_step=0 then continue; end if;
      r:=p_row+dr*sign_step; c:=p_col+dc*sign_step;
      while r between 0 and 14 and c between 0 and 14 loop
        exit when next_board #>> array[r::text,c::text] is distinct from stone;
        count_line:=count_line+1;
        r:=r+dr*sign_step; c:=c+dc*sign_step;
      end loop;
    end loop;
    if count_line>=5 then won:=true; exit; end if;
  end loop;
  finished:=won or p_turn=225;
  update public.omok_matches set
    board_state=next_board,
    turn_no=p_turn+1,
    turn_user_id=case when actor=black_id then white_id else black_id end,
    status=case when finished then 'finished' else 'active' end,
    winner_id=case when won then actor else null end,
    finish_reason=case when won then 'five' when finished then 'draw' else null end,
    finished_at=case when finished then now() else null end
  where id=p_match_id;
  insert into public.omok_moves(match_id,turn_no,request_id,player_id,stone,row_no,col_no)
    values(p_match_id,p_turn,p_request_id,actor,stone,p_row,p_col);
  return jsonb_build_object('id',game.id,
    'status',case when finished then 'finished' else 'active' end,
    'turnNo',p_turn+1,
    'turnUserId',case when actor=game.black_id then game.white_id else game.black_id end,
    'winnerId',case when won then actor else null end,
    'finishReason',case when won then 'five' when finished then 'draw' else null end,
    'boardState',next_board,'replayed',false);
end;
$$;

create function public.forfeit_omok_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); game public.omok_matches%rowtype; other_user uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into game from public.omok_matches where id=p_match_id for update;
  if not found or actor not in(game.black_id,game.white_id) then
    raise exception 'MATCH_NOT_FOUND'; end if;
  if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
  other_user:=case when actor=game.black_id then game.white_id else game.black_id end;
  update public.omok_matches set
    status='finished',winner_id=other_user,finish_reason='forfeit',finished_at=now()
  where id=p_match_id;
  return jsonb_build_object('winnerId',other_user,'finishReason','forfeit');
end;
$$;

-- PUBLIC receives default EXECUTE on functions. Explicitly revoke it first.
revoke all on function public.create_omok_room(text) from public,anon,authenticated;
revoke all on function public.join_omok_room(text) from public,anon,authenticated;
revoke all on function public.get_omok_room(uuid) from public,anon,authenticated;
revoke all on function public.leave_omok_room(uuid) from public,anon,authenticated;
revoke all on function public.start_omok_match(uuid) from public,anon,authenticated;
revoke all on function public.play_omok_move(uuid,uuid,integer,integer,integer)
  from public,anon,authenticated;
revoke all on function public.forfeit_omok_match(uuid) from public,anon,authenticated;
grant execute on function public.create_omok_room(text) to authenticated;
grant execute on function public.join_omok_room(text) to authenticated;
grant execute on function public.get_omok_room(uuid) to authenticated;
grant execute on function public.leave_omok_room(uuid) to authenticated;
grant execute on function public.start_omok_match(uuid) to authenticated;
grant execute on function public.play_omok_move(uuid,uuid,integer,integer,integer) to authenticated;
grant execute on function public.forfeit_omok_match(uuid) to authenticated;

alter publication supabase_realtime add table public.omok_rooms;
alter publication supabase_realtime add table public.omok_matches;
alter publication supabase_realtime add table public.omok_moves;

commit;
