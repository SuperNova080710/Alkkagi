begin;
-- Multiple games can be played in one room; each match keeps its own shots.
alter table public.matches drop constraint if exists matches_room_id_key;
create index if not exists matches_room_history_idx
 on public.matches(room_id,created_at desc,id desc);

create table public.rematch_votes (
 match_id uuid not null references public.matches(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 primary key (match_id,user_id)
);
alter table public.rematch_votes enable row level security;
revoke all on public.rematch_votes from public,anon,authenticated;
grant all on public.rematch_votes to service_role;

create function public.request_casual_rematch(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid := auth.uid();
 v_room public.rooms%rowtype;
 v_latest public.matches%rowtype;
 v_votes integer;
 v_new_match uuid;
 v_pieces jsonb;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
 -- Serialize simultaneous rematch requests and prevent duplicate new matches.
 select * into v_room from public.rooms where id=p_room_id for update;
 if not found or v_room.status <> 'playing' then raise exception 'ROOM_NOT_FOUND'; end if;
 if not exists (
  select 1 from public.room_players where room_id=p_room_id and user_id=v_actor
 ) then raise exception 'NOT_PARTICIPANT'; end if;
 select * into v_latest from public.matches
  where room_id=p_room_id
  order by created_at desc,id desc limit 1;
 if not found or v_latest.status <> 'finished' then raise exception 'MATCH_NOT_FINISHED'; end if;
 insert into public.rematch_votes(match_id,user_id)
  values(v_latest.id,v_actor) on conflict do nothing;
 select count(*) into v_votes from public.rematch_votes where match_id=v_latest.id;
 if v_votes < 2 then
  return jsonb_build_object('started',false,'readyCount',v_votes,'matchId',v_latest.id);
 end if;

 -- The room lock guarantees exactly one successful second vote creates a match.
 select jsonb_agg(jsonb_build_object('id',piece_id,'owner',owner,'x',x,'y',y) order by piece_id)
  into v_pieces from (
   select 'a'||n as piece_id,v_latest.player1_id as owner,175::float8 as x,
     (70+n*60)::float8 as y from generate_series(1,5) n
   union all
   select 'b'||n as piece_id,v_latest.player2_id as owner,625::float8 as x,
     (70+n*60)::float8 as y from generate_series(1,5) n
  ) board;
 insert into public.matches(room_id,player1_id,player2_id,turn_user_id,board_state)
  values(p_room_id,v_latest.player1_id,v_latest.player2_id,v_latest.player1_id,
    jsonb_build_object('pieces',v_pieces)) returning id into v_new_match;
 return jsonb_build_object('started',true,'readyCount',2,'matchId',v_new_match);
end;
$$;
revoke all on function public.request_casual_rematch(uuid) from public,anon;
grant execute on function public.request_casual_rematch(uuid) to authenticated;

-- A participant can read only their room and its rematch status.
create or replace function public.get_casual_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid := auth.uid();
 v_result jsonb;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.room_players
   where room_id=p_room_id and user_id=v_user) then
  raise exception 'ROOM_NOT_FOUND'; end if;
 select jsonb_build_object(
  'id',r.id,'code',r.code,'status',r.status,
  'yourSeat',(select rp.seat from public.room_players rp
    where rp.room_id=r.id and rp.user_id=v_user),
  'players',coalesce((
   select jsonb_agg(jsonb_build_object('seat',rp.seat,'nickname',p.nickname) order by rp.seat)
   from public.room_players rp join public.profiles p on p.id=rp.user_id
   where rp.room_id=r.id
  ),'[]'::jsonb),
  'rematchReadyCount',(
   select count(*) from public.rematch_votes rv
   where rv.match_id=(
    select m.id from public.matches m where m.room_id=r.id
    order by m.created_at desc,m.id desc limit 1
   )
  ),
  'myRematchVote',exists(
   select 1 from public.rematch_votes rv where rv.user_id=v_user
   and rv.match_id=(
    select m.id from public.matches m where m.room_id=r.id
    order by m.created_at desc,m.id desc limit 1
   )
  )
 ) into v_result from public.rooms r where r.id=p_room_id;
 return v_result;
end;
$$;
revoke all on function public.get_casual_room(uuid) from public,anon;
grant execute on function public.get_casual_room(uuid) to authenticated;
commit;