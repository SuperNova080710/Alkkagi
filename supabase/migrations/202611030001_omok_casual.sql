begin;

-- v0.3.0 Omok: isolated schema; leave Alkkagi games, queues and ratings untouched.
create table public.omok_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-HJ-NP-Z2-9]{8}$'),
 owner_id uuid not null references public.profiles(id),
 status text not null default 'waiting' check(status in ('waiting','playing','closed')),
 expires_at timestamptz not null default (now()+interval '30 minutes'),
 created_at timestamptz not null default now(),
 check(expires_at>created_at)
);
create table public.omok_room_players (
 room_id uuid not null references public.omok_rooms(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 seat smallint not null check(seat between 1 and 2),
 primary key(room_id,user_id), unique(room_id,seat)
);
create table public.omok_matches (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null unique references public.omok_rooms(id),
 black_id uuid not null references public.profiles(id),
 white_id uuid not null references public.profiles(id),
 status text not null default 'active' check(status in ('active','finished')),
 turn_no integer not null default 1 check(turn_no between 1 and 226),
 board jsonb not null check(jsonb_typeof(board)='array' and jsonb_array_length(board)=225),
 winner_id uuid references public.profiles(id),
 finished_at timestamptz,
 created_at timestamptz not null default now(),
 check(black_id<>white_id),
 check(winner_id is null or winner_id in (black_id,white_id)),
 check((status='active' and finished_at is null and winner_id is null) or
       (status='finished' and finished_at is not null))
);
create table public.omok_moves (
 match_id uuid not null references public.omok_matches(id) on delete cascade,
 turn_no integer not null check(turn_no between 1 and 225),
 request_id uuid not null,
 player_id uuid not null references public.profiles(id),
 row smallint not null check(row between 0 and 14),
 col smallint not null check(col between 0 and 14),
 created_at timestamptz not null default now(),
 primary key(match_id,turn_no), unique(match_id,request_id),
 unique(match_id,row,col)
);
create index omok_rooms_owner_idx on public.omok_rooms(owner_id);
create index omok_matches_black_idx on public.omok_matches(black_id,status);
create index omok_matches_white_idx on public.omok_matches(white_id,status);
create index omok_moves_player_idx on public.omok_moves(player_id,created_at desc);

alter table public.omok_rooms enable row level security;
alter table public.omok_room_players enable row level security;
alter table public.omok_matches enable row level security;
alter table public.omok_moves enable row level security;
revoke all on public.omok_rooms,public.omok_room_players,public.omok_matches,public.omok_moves
 from public,anon,authenticated;
grant select on public.omok_rooms,public.omok_room_players,public.omok_matches,public.omok_moves to authenticated;
grant all on public.omok_rooms,public.omok_room_players,public.omok_matches,public.omok_moves to service_role;
create policy omok_rooms_members on public.omok_rooms for select to authenticated
 using(exists(select 1 from public.omok_room_players rp
   where rp.room_id=omok_rooms.id and rp.user_id=(select auth.uid())));
create policy omok_room_players_members on public.omok_room_players for select to authenticated
 using(exists(select 1 from public.omok_room_players rp
   where rp.room_id=omok_room_players.room_id and rp.user_id=(select auth.uid())));
create policy omok_matches_members on public.omok_matches for select to authenticated
 using((select auth.uid()) in (black_id,white_id));
create policy omok_moves_members on public.omok_moves for select to authenticated
 using(exists(select 1 from public.omok_matches m
   where m.id=omok_moves.match_id and (select auth.uid()) in (m.black_id,m.white_id)));

create function public.create_omok_room(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'INVALID_CODE'; end if;
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'PROFILE_MISSING'; end if;
 if (select count(*) from public.omok_rooms where owner_id=actor
     and status='waiting' and expires_at>now())>=3 then raise exception 'ROOM_LIMIT'; end if;
 insert into public.omok_rooms(code,owner_id) values(p_code,actor) returning id into result;
 insert into public.omok_room_players(room_id,user_id,seat) values(result,actor,1);
 return result;
end;
$$;

create function public.join_omok_room(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room public.omok_rooms%rowtype;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'INVALID_CODE'; end if;
 select * into room from public.omok_rooms where code=p_code for update;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 if exists(select 1 from public.omok_room_players where room_id=room.id and user_id=actor)
   then return room.id; end if;
 if room.status<>'waiting' or room.expires_at<=now() then raise exception 'ROOM_UNAVAILABLE'; end if;
 if exists(select 1 from public.omok_room_players where room_id=room.id and seat=2)
   then raise exception 'ROOM_FULL'; end if;
 insert into public.omok_room_players(room_id,user_id,seat) values(room.id,actor,2);
 return room.id;
end;
$$;

create function public.get_omok_room(p_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.omok_room_players where room_id=p_room_id and user_id=actor)
   then raise exception 'ROOM_NOT_FOUND'; end if;
 select jsonb_build_object('id',r.id,'code',r.code,'status',r.status,
  'yourSeat',(select seat from public.omok_room_players where room_id=r.id and user_id=actor),
  'players',coalesce((select jsonb_agg(jsonb_build_object('seat',rp.seat,'id',rp.user_id,
    'nickname',p.nickname) order by rp.seat)
    from public.omok_room_players rp join public.profiles p on p.id=rp.user_id
    where rp.room_id=r.id),'[]'::jsonb))
 into result from public.omok_rooms r where r.id=p_room_id;
 return result;
end;
$$;

create function public.leave_omok_room(p_room_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
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

create function public.start_omok_match(p_room_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room public.omok_rooms%rowtype; guest uuid; result uuid;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into room from public.omok_rooms where id=p_room_id for update;
 if not found or room.owner_id<>actor then raise exception 'NOT_HOST'; end if;
 if room.status<>'waiting' or room.expires_at<=now() then raise exception 'ROOM_UNAVAILABLE'; end if;
 select user_id into guest from public.omok_room_players where room_id=p_room_id and seat=2;
 if guest is null then raise exception 'NEED_TWO_PLAYERS'; end if;
 if not exists(select 1 from public.omok_room_players
   where room_id=p_room_id and user_id=actor and seat=1) then raise exception 'INVALID_HOST'; end if;
 insert into public.omok_matches(room_id,black_id,white_id,board)
 select p_room_id,actor,guest,jsonb_agg('null'::jsonb order by n)
 from generate_series(1,225) as n returning id into result;
 update public.omok_rooms set status='playing' where id=p_room_id;
 return result;
end;
$$;

-- One atomic, server-authoritative move. Never accept client board/winner/XP.
create function public.play_omok_move(
 p_match_id uuid,p_turn integer,p_request uuid,p_row integer,p_col integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); game public.omok_matches%rowtype;
 stone text; next_board jsonb; idx integer; direction record;
 delta integer; rr integer; cc integer; run_length integer; winning boolean:=false;
 next_status text; winner uuid; existing public.omok_moves%rowtype;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_match_id is null or p_request is null or p_turn is null or
    p_row is null or p_col is null or p_row not between 0 and 14 or p_col not between 0 and 14
 then raise exception 'INVALID_MOVE'; end if;
 select * into game from public.omok_matches where id=p_match_id for update;
 if not found or actor not in(game.black_id,game.white_id) then raise exception 'MATCH_NOT_FOUND'; end if;
 select * into existing from public.omok_moves where match_id=p_match_id and request_id=p_request;
 if found then
   if existing.player_id=actor and existing.turn_no=p_turn and
      existing.row=p_row and existing.col=p_col then
     return jsonb_build_object('status','already_committed','turnNo',existing.turn_no);
   end if;
   raise exception 'DUPLICATE_REQUEST';
 end if;
 if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
 if game.turn_no<>p_turn then raise exception 'STALE_TURN'; end if;
 if (case when p_turn%2=1 then game.black_id else game.white_id end)<>actor
   then raise exception 'NOT_YOUR_TURN'; end if;
 idx:=p_row*15+p_col;
 if game.board->idx <> 'null'::jsonb then raise exception 'CELL_OCCUPIED'; end if;
 stone:=case when p_turn%2=1 then 'black' else 'white' end;
 next_board:=jsonb_set(game.board,array[idx::text],to_jsonb(stone),false);
 for direction in select dr,dc from (values (0,1),(1,0),(1,1),(1,-1)) as d(dr,dc) loop
   run_length:=1;
   for delta in -1..1 loop
     if delta=0 then continue; end if;
     rr:=p_row+delta*direction.dr; cc:=p_col+delta*direction.dc;
     while rr between 0 and 14 and cc between 0 and 14 loop
       exit when next_board->>(rr*15+cc) is distinct from stone;
       run_length:=run_length+1;
       rr:=rr+delta*direction.dr; cc:=cc+delta*direction.dc;
     end loop;
   end loop;
   if run_length>=5 then winning:=true; exit; end if;
 end loop;
 next_status:=case when winning or p_turn=225 then 'finished' else 'active' end;
 winner:=case when winning then actor else null end;
 insert into public.omok_moves(match_id,turn_no,request_id,player_id,row,col)
 values(p_match_id,p_turn,p_request,actor,p_row,p_col);
 update public.omok_matches set board=next_board,turn_no=p_turn+1,status=next_status,
   winner_id=winner,finished_at=case when next_status='finished' then now() else null end
 where id=p_match_id;
 return jsonb_build_object('status',next_status,'turnNo',p_turn+1,'board',next_board,
   'winnerId',winner,'lastRow',p_row,'lastCol',p_col);
end;
$$;

create function public.forfeit_omok_match(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); game public.omok_matches%rowtype; winner uuid;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into game from public.omok_matches where id=p_match_id for update;
 if not found or actor not in(game.black_id,game.white_id) then raise exception 'MATCH_NOT_FOUND'; end if;
 if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
 winner:=case when actor=game.black_id then game.white_id else game.black_id end;
 update public.omok_matches set status='finished',winner_id=winner,finished_at=now()
 where id=p_match_id;
 return jsonb_build_object('status','finished','winnerId',winner);
end;
$$;

revoke all on function public.create_omok_room(text) from public,anon;
revoke all on function public.join_omok_room(text) from public,anon;
revoke all on function public.get_omok_room(uuid) from public,anon;
revoke all on function public.leave_omok_room(uuid) from public,anon;
revoke all on function public.start_omok_match(uuid) from public,anon;
revoke all on function public.play_omok_move(uuid,integer,uuid,integer,integer) from public,anon;
revoke all on function public.forfeit_omok_match(uuid) from public,anon;
grant execute on function public.create_omok_room(text),public.join_omok_room(text),
 public.get_omok_room(uuid),public.leave_omok_room(uuid),public.start_omok_match(uuid),
 public.play_omok_move(uuid,integer,uuid,integer,integer),public.forfeit_omok_match(uuid)
 to authenticated;
alter publication supabase_realtime add table public.omok_matches;
alter publication supabase_realtime add table public.omok_rooms;
commit;
