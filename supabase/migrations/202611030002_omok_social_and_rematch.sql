begin;

-- v0.3.0 Omok social and rematch extension (#221). Depends on 202611030001.
create table public.omok_match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.omok_matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  request_id uuid not null,
  body text not null check(char_length(body) between 1 and 280 and body=btrim(body)),
  created_at timestamptz not null default now(),
  unique(match_id,sender_id,request_id)
);
create index omok_match_messages_recent_idx on public.omok_match_messages(match_id,created_at desc,id desc);

create table public.omok_rematch_votes (
  match_id uuid not null references public.omok_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  voted_at timestamptz not null default now(),
  primary key(match_id,user_id)
);

alter table public.omok_match_messages enable row level security;
alter table public.omok_rematch_votes enable row level security;
revoke all on public.omok_match_messages,public.omok_rematch_votes from public,anon,authenticated;
grant select on public.omok_match_messages,public.omok_rematch_votes to authenticated;
grant all on public.omok_match_messages,public.omok_rematch_votes to service_role;
create policy omok_match_messages_read_participants on public.omok_match_messages for select to authenticated
  using(exists(select 1 from public.omok_matches m where m.id=omok_match_messages.match_id
    and (select auth.uid()) in(m.black_id,m.white_id)));
create policy omok_rematch_votes_read_own on public.omok_rematch_votes for select to authenticated
  using(user_id=(select auth.uid()));

create function public.send_omok_match_message(
  p_match_id uuid,p_body text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  game public.omok_matches%rowtype;
  body_clean text;
  existing public.omok_match_messages%rowtype;
  last_time timestamptz;
  message_id uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or p_request_id is null then raise exception 'INVALID_MESSAGE'; end if;
  body_clean:=btrim(p_body);
  if body_clean is null or char_length(body_clean) not between 1 and 280
    then raise exception 'INVALID_MESSAGE'; end if;
  -- Serialize sender throttling across all Omok matches.
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  select * into game from public.omok_matches where id=p_match_id;
  if not found or actor not in(game.black_id,game.white_id) then raise exception 'MATCH_NOT_FOUND'; end if;
  select * into existing from public.omok_match_messages
    where match_id=p_match_id and sender_id=actor and request_id=p_request_id;
  if found then
    if existing.body<>body_clean then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',existing.id,'replayed',true);
  end if;
  if game.status<>'active' and
    not (game.status='finished' and game.finished_at>now()-interval '30 minutes') then
    raise exception 'CHAT_CLOSED'; end if;
  select created_at into last_time from public.omok_match_messages
    where sender_id=actor order by created_at desc,id desc limit 1;
  if last_time>clock_timestamp()-interval '1 second' then raise exception 'CHAT_RATE_LIMIT'; end if;
  if (select count(*) from public.omok_match_messages
      where match_id=p_match_id)>=500 then raise exception 'CHAT_FULL'; end if;
  insert into public.omok_match_messages(match_id,sender_id,request_id,body)
    values(p_match_id,actor,p_request_id,body_clean) returning id into message_id;
  return jsonb_build_object('id',message_id,'replayed',false);
end;
$$;

create function public.vote_omok_rematch(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  room public.omok_rooms%rowtype;
  game public.omok_matches%rowtype;
  votes integer;
  next_id uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room_id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  -- Stable lock order, serializing concurrent first/second votes.
  select * into room from public.omok_rooms where id=p_room_id for update;
  if not found or room.status<>'playing' then raise exception 'ROOM_NOT_FOUND'; end if;
  select * into game from public.omok_matches
    where room_id=p_room_id order by created_at desc,id desc limit 1 for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if actor not in(game.black_id,game.white_id) or
    not exists(select 1 from public.omok_room_players rp
      where rp.room_id=p_room_id and rp.user_id=actor) then
    raise exception 'MATCH_NOT_FOUND'; end if;
  if game.status<>'finished' then raise exception 'MATCH_ACTIVE'; end if;
  if game.finished_at<clock_timestamp()-interval '30 minutes' then
    raise exception 'REMATCH_EXPIRED'; end if;
  insert into public.omok_rematch_votes(match_id,user_id) values(game.id,actor)
    on conflict do nothing;
  select count(*) into votes from public.omok_rematch_votes where match_id=game.id;
  if votes<2 then
    return jsonb_build_object('status','waiting','readyCount',votes,'matchId',game.id);
  end if;
  -- Alternate colors on every rematch. The first accepted event is a new
  -- match row, so old moves and message history remain immutable.
  insert into public.omok_matches(room_id,black_id,white_id,turn_user_id,board_state)
    values(p_room_id,game.white_id,game.black_id,game.white_id,
      to_jsonb(array_fill(null::text,array[15,15])))
    returning id into next_id;
  return jsonb_build_object('status','started','readyCount',2,'matchId',next_id);
end;
$$;

revoke all on function public.send_omok_match_message(uuid,text,uuid)
  from public,anon,authenticated;
revoke all on function public.vote_omok_rematch(uuid)
  from public,anon,authenticated;
grant execute on function public.send_omok_match_message(uuid,text,uuid)
  to authenticated;
grant execute on function public.vote_omok_rematch(uuid)
  to authenticated;

alter publication supabase_realtime add table public.omok_match_messages;
alter publication supabase_realtime add table public.omok_rematch_votes;

commit;
