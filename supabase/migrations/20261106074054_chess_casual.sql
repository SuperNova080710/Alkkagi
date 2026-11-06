begin;

create table public.chess_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  host_id uuid not null references public.profiles(id),
  guest_id uuid references public.profiles(id),
  create_request_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  closed_at timestamptz,
  unique (host_id, create_request_id),
  check (guest_id is distinct from host_id)
);
create index chess_rooms_host_created_idx on public.chess_rooms(host_id,created_at desc);

create table public.chess_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.chess_rooms(id),
  white_id uuid not null references public.profiles(id),
  black_id uuid not null references public.profiles(id),
  ply integer not null default 0 check (ply >= 0),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  in_check boolean not null default false,
  winner_id uuid references public.profiles(id),
  finish_reason text check (finish_reason in (
    'checkmate','stalemate','insufficient-material','threefold-repetition','fifty-move-rule','resignation'
  )),
  resign_request_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (white_id <> black_id),
  check (winner_id is null or winner_id in (white_id,black_id)),
  check ((finished_at is null) = (finish_reason is null)),
  check ((winner_id is not null) = coalesce(finish_reason in ('checkmate','resignation'),false)),
  check ((resign_request_id is not null) = coalesce(finish_reason='resignation',false))
);

create table public.chess_moves (
  match_id uuid not null references public.chess_matches(id) on delete cascade,
  ply integer not null check (ply > 0),
  player_id uuid not null references public.profiles(id),
  request_id uuid not null,
  from_square text not null check (from_square ~ '^[a-h][1-8]$'),
  to_square text not null check (to_square ~ '^[a-h][1-8]$'),
  promotion text check (promotion in ('q','r','b','n')),
  san text not null check (char_length(san) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (match_id,ply),
  unique (match_id,request_id)
);

alter table public.chess_rooms enable row level security;
alter table public.chess_matches enable row level security;
alter table public.chess_moves enable row level security;
revoke all on public.chess_rooms, public.chess_matches, public.chess_moves from public,anon,authenticated,service_role;
grant select on public.chess_rooms, public.chess_matches, public.chess_moves to authenticated;
grant select,insert,update on public.chess_rooms, public.chess_matches to service_role;
grant select,insert on public.chess_moves to service_role;

create policy chess_rooms_participants on public.chess_rooms for select to authenticated
  using ((select auth.uid()) in (host_id,guest_id));
create policy chess_matches_participants on public.chess_matches for select to authenticated
  using ((select auth.uid()) in (white_id,black_id));
create policy chess_moves_participants on public.chess_moves for select to authenticated
  using (exists (
    select 1 from public.chess_matches m where m.id=chess_moves.match_id
      and (select auth.uid()) in (m.white_id,m.black_id)
  ));

-- Authentication and chess rule evaluation are performed by the trusted API.
-- Only service_role may invoke writes. Invoker functions need no privilege escalation.
create function public.chess_create_room(p_actor uuid,p_request_id uuid,p_code text)
returns uuid language plpgsql set search_path='' as $$
declare room_id uuid; checked_at timestamptz;
begin
  perform 1 from public.profiles where id=p_actor for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  select id into room_id from public.chess_rooms
    where host_id=p_actor and create_request_id=p_request_id;
  if found then return room_id; end if;
  checked_at:=clock_timestamp();
  if (select count(*) from public.chess_rooms r where r.host_id=p_actor and r.closed_at is null
      and r.expires_at>checked_at and not exists(select 1 from public.chess_matches m where m.room_id=r.id))>=5 then
    raise exception 'ROOM_ACTIVE_LIMIT';
  end if;
  if (select count(*) from public.chess_rooms
      where host_id=p_actor and created_at>checked_at-interval '1 hour')>=10 then
    raise exception 'ROOM_RATE_LIMIT';
  end if;
  insert into public.chess_rooms(host_id,create_request_id,code) values(p_actor,p_request_id,p_code)
    returning id into room_id;
  return room_id;
end;
$$;

create function public.chess_join_room(p_actor uuid,p_code text)
returns uuid language plpgsql set search_path='' as $$
declare room public.chess_rooms%rowtype;
begin
  select * into room from public.chess_rooms where code=p_code for update;
  if not found or p_actor is null or room.closed_at is not null then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if exists(select 1 from public.chess_matches where room_id=room.id) then
    if p_actor in (room.host_id,room.guest_id) then return room.id; end if;
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if room.expires_at<=clock_timestamp() then raise exception 'ROOM_NOT_FOUND'; end if;
  if p_actor in (room.host_id,room.guest_id) then return room.id; end if;
  if room.guest_id is not null then raise exception 'ROOM_FULL'; end if;
  update public.chess_rooms set guest_id=p_actor where id=room.id;
  return room.id;
end;
$$;

create function public.chess_start_match(p_actor uuid,p_room_id uuid)
returns uuid language plpgsql set search_path='' as $$
declare room public.chess_rooms%rowtype; match_id uuid;
begin
  select * into room from public.chess_rooms where id=p_room_id for update;
  if not found or p_actor is null or (p_actor<>room.host_id and p_actor is distinct from room.guest_id) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if room.host_id<>p_actor then raise exception 'NOT_HOST'; end if;
  select id into match_id from public.chess_matches where room_id=room.id;
  if found then return match_id; end if;
  if room.closed_at is not null or room.expires_at<=clock_timestamp() then raise exception 'ROOM_CLOSED'; end if;
  if room.guest_id is null then raise exception 'NEED_TWO_PLAYERS'; end if;
  insert into public.chess_matches(room_id,white_id,black_id) values(room.id,room.host_id,room.guest_id)
    returning id into match_id;
  return match_id;
end;
$$;

create function public.chess_leave_room(p_actor uuid,p_room_id uuid)
returns void language plpgsql set search_path='' as $$
declare room public.chess_rooms%rowtype;
begin
  select * into room from public.chess_rooms where id=p_room_id for update;
  if not found or p_actor is null or (p_actor<>room.host_id and p_actor is distinct from room.guest_id) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if exists(select 1 from public.chess_matches where room_id=room.id) then
    raise exception 'MATCH_ALREADY_STARTED';
  end if;
  if p_actor=room.host_id then
    update public.chess_rooms set closed_at=clock_timestamp() where id=room.id and closed_at is null;
  else
    update public.chess_rooms set guest_id=null where id=room.id;
  end if;
end;
$$;

create function public.chess_room_snapshot(p_room_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',r.id,'code',r.code,'hostId',r.host_id,'guestId',r.guest_id,'expiresAt',r.expires_at,
    'status',case when m.id is not null then 'started'
      when r.closed_at is not null or r.expires_at<=statement_timestamp() then 'closed' else 'waiting' end,
    'matchId',m.id)
  from public.chess_rooms r left join public.chess_matches m on m.room_id=r.id
  where r.id=p_room_id and (select auth.uid()) in (r.host_id,r.guest_id)
$$;

create function public.chess_match_snapshot(p_match_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('match',to_jsonb(m),'moves',coalesce((
    select jsonb_agg(to_jsonb(t) order by t.ply) from public.chess_moves t where t.match_id=m.id
  ),'[]'::jsonb))
  from public.chess_matches m
  where m.id=p_match_id and (select auth.uid()) in (m.white_id,m.black_id)
$$;

create function public.chess_commit_move(
  p_actor uuid,p_match_id uuid,p_request_id uuid,p_expected_ply integer,
  p_from text,p_to text,p_promotion text,p_san text,p_fen text,p_in_check boolean,p_finish_reason text
) returns void language plpgsql set search_path='' as $$
declare game public.chess_matches%rowtype; previous public.chess_moves%rowtype;
begin
  select * into game from public.chess_matches where id=p_match_id for update;
  if not found or p_actor is null or p_actor not in (game.white_id,game.black_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  select * into previous from public.chess_moves where match_id=game.id and request_id=p_request_id;
  if found then
    if previous.player_id is distinct from p_actor or previous.ply-1 is distinct from p_expected_ply
      or previous.from_square is distinct from p_from or previous.to_square is distinct from p_to
      or previous.promotion is distinct from p_promotion then raise exception 'REQUEST_CONFLICT'; end if;
    return;
  end if;
  if game.finished_at is not null then raise exception 'MATCH_FINISHED'; end if;
  if game.ply is distinct from p_expected_ply then raise exception 'STALE_TURN'; end if;
  if p_actor<>(case when game.ply%2=0 then game.white_id else game.black_id end) then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if p_finish_reason='resignation' then raise exception 'INVALID_MOVE'; end if;
  insert into public.chess_moves(match_id,ply,player_id,request_id,from_square,to_square,promotion,san)
    values(game.id,game.ply+1,p_actor,p_request_id,p_from,p_to,p_promotion,p_san);
  update public.chess_matches set
    ply=game.ply+1,fen=p_fen,in_check=p_in_check,finish_reason=p_finish_reason,
    finished_at=case when p_finish_reason is not null then clock_timestamp() end,
    winner_id=case when p_finish_reason='checkmate' then p_actor end
  where id=game.id;
end;
$$;

create function public.chess_resign(p_actor uuid,p_match_id uuid,p_request_id uuid)
returns void language plpgsql set search_path='' as $$
declare game public.chess_matches%rowtype;
begin
  select * into game from public.chess_matches where id=p_match_id for update;
  if not found or p_actor is null or p_actor not in (game.white_id,game.black_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  if game.resign_request_id=p_request_id then
    if game.winner_id=p_actor then raise exception 'REQUEST_CONFLICT'; end if;
    return;
  end if;
  if game.finished_at is not null then raise exception 'MATCH_FINISHED'; end if;
  update public.chess_matches set
    winner_id=case when p_actor=game.white_id then game.black_id else game.white_id end,
    finish_reason='resignation',resign_request_id=p_request_id,finished_at=clock_timestamp()
  where id=game.id;
end;
$$;

revoke all on function
  public.chess_create_room(uuid,uuid,text),public.chess_join_room(uuid,text),
  public.chess_start_match(uuid,uuid),public.chess_leave_room(uuid,uuid),
  public.chess_commit_move(uuid,uuid,uuid,integer,text,text,text,text,text,boolean,text),
  public.chess_resign(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function
  public.chess_create_room(uuid,uuid,text),public.chess_join_room(uuid,text),
  public.chess_start_match(uuid,uuid),public.chess_leave_room(uuid,uuid),
  public.chess_commit_move(uuid,uuid,uuid,integer,text,text,text,text,text,boolean,text),
  public.chess_resign(uuid,uuid,uuid)
  to service_role;
revoke all on function public.chess_room_snapshot(uuid),public.chess_match_snapshot(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.chess_room_snapshot(uuid),public.chess_match_snapshot(uuid) to authenticated;

alter publication supabase_realtime add table public.chess_rooms,public.chess_matches;

commit;
