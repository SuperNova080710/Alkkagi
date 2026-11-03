begin;

-- v0.3.0 Omok ranked (#223): independent RP/queue/leaderboard.
-- The original Alkkagi profiles.rating, ranked_queue and rating_history are untouched.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

alter table public.omok_matches add column mode text not null default 'casual'
  check(mode in('casual','ranked'));
alter table public.omok_matches alter column room_id drop not null;
alter table public.omok_matches add constraint omok_matches_mode_room_check
  check((mode='casual' and room_id is not null) or (mode='ranked' and room_id is null));
alter table public.omok_matches add column turn_deadline timestamptz;
alter table public.omok_matches drop constraint omok_matches_finish_reason_check;
alter table public.omok_matches add constraint omok_matches_finish_reason_check
  check(finish_reason in('five','draw','forfeit','timeout'));

create table private.omok_rank_queue_lock(
  id boolean primary key default true check(id)
);
insert into private.omok_rank_queue_lock(id) values(true) on conflict do nothing;
revoke all on private.omok_rank_queue_lock from public,anon,authenticated;

create table public.omok_ratings(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rating integer not null default 1000 check(rating>=0),
  wins integer not null default 0 check(wins>=0),
  losses integer not null default 0 check(losses>=0),
  draws integer not null default 0 check(draws>=0),
  updated_at timestamptz not null default now()
);
create index omok_ratings_top_idx on public.omok_ratings(rating desc,wins desc,user_id);

create table public.omok_ranked_queue(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rating_snapshot integer not null check(rating_snapshot>=0),
  joined_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);
create index omok_ranked_queue_idx on public.omok_ranked_queue(heartbeat_at,joined_at);

create table public.omok_rating_history(
  match_id uuid not null references public.omok_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  before_rating integer not null check(before_rating>=0),
  after_rating integer not null check(after_rating>=0),
  delta integer not null,
  created_at timestamptz not null default now(),
  primary key(match_id,user_id),
  check(after_rating=before_rating+delta)
);
create index omok_rating_history_user_idx on public.omok_rating_history(user_id,created_at desc);

alter table public.omok_ratings enable row level security;
alter table public.omok_ranked_queue enable row level security;
alter table public.omok_rating_history enable row level security;
revoke all on public.omok_ratings,public.omok_ranked_queue,public.omok_rating_history
  from public,anon,authenticated;
grant select on public.omok_ratings,public.omok_rating_history to authenticated;
grant all on public.omok_ratings,public.omok_ranked_queue,public.omok_rating_history to service_role;
create policy omok_rating_self on public.omok_ratings for select to authenticated
  using(user_id=(select auth.uid()));
create policy omok_history_self on public.omok_rating_history for select to authenticated
  using(user_id=(select auth.uid()));

create function private.omok_refresh_turn_deadline()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- A winning move is still late if it arrives after the deadline.
  if tg_op='UPDATE' then
    if new.mode='ranked' and new.turn_no is distinct from old.turn_no
      and old.turn_deadline<=clock_timestamp() then
      raise exception 'TURN_EXPIRED';
    end if;
  end if;
  if new.mode<>'ranked' or new.status<>'active' then
    new.turn_deadline:=null;
  elsif tg_op='INSERT' then
    new.turn_deadline:=clock_timestamp()+interval '90 seconds';
  elsif new.turn_no is distinct from old.turn_no then
    new.turn_deadline:=clock_timestamp()+interval '90 seconds';
  end if;
  return new;
end;
$$;
revoke all on function private.omok_refresh_turn_deadline() from public,anon,authenticated,service_role;
create trigger omok_ranked_turn_deadline
  before insert or update of turn_no,status on public.omok_matches
  for each row execute function private.omok_refresh_turn_deadline();

-- Idempotent ELO K=32, only on ACTIVE->FINISHED transitions.
create function private.omok_settle_ranked(p_match_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  game public.omok_matches%rowtype;
  first_rating public.omok_ratings%rowtype;
  second_rating public.omok_ratings%rowtype;
  score numeric; expected numeric; change integer;
  after_first integer; after_second integer;
begin
  select * into game from public.omok_matches where id=p_match_id for update;
  if not found or game.mode<>'ranked' or game.status<>'finished' then return; end if;
  if exists(select 1 from public.omok_rating_history where match_id=p_match_id) then return; end if;
  perform 1 from public.omok_ratings
    where user_id in(game.black_id,game.white_id) order by user_id for update;
  select * into first_rating from public.omok_ratings where user_id=game.black_id;
  select * into second_rating from public.omok_ratings where user_id=game.white_id;
  if first_rating.user_id is null or second_rating.user_id is null then
    raise exception 'RATING_MISSING'; end if;
  score:=case when game.winner_id=game.black_id then 1
              when game.winner_id=game.white_id then 0 else 0.5 end;
  expected:=1/(1+power(10::numeric,(second_rating.rating-first_rating.rating)/400.0));
  change:=round(32*(score-expected))::integer;
  after_first:=greatest(0,first_rating.rating+change);
  after_second:=greatest(0,second_rating.rating-change);
  update public.omok_ratings set rating=after_first,
    wins=wins+case when score=1 then 1 else 0 end,
    losses=losses+case when score=0 then 1 else 0 end,
    draws=draws+case when score=0.5 then 1 else 0 end,
    updated_at=now() where user_id=game.black_id;
  update public.omok_ratings set rating=after_second,
    wins=wins+case when score=0 then 1 else 0 end,
    losses=losses+case when score=1 then 1 else 0 end,
    draws=draws+case when score=0.5 then 1 else 0 end,
    updated_at=now() where user_id=game.white_id;
  insert into public.omok_rating_history(match_id,user_id,before_rating,after_rating,delta)
    values(p_match_id,game.black_id,first_rating.rating,after_first,after_first-first_rating.rating),
          (p_match_id,game.white_id,second_rating.rating,after_second,after_second-second_rating.rating);
end;
$$;
revoke all on function private.omok_settle_ranked(uuid) from public,anon,authenticated,service_role;

create function private.omok_after_ranked_finished()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='active' and new.status='finished' and new.mode='ranked' then
    perform private.omok_settle_ranked(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.omok_after_ranked_finished()
  from public,anon,authenticated,service_role;
create trigger omok_ranked_finished
  after update of status on public.omok_matches for each row
  when(old.status='active' and new.status='finished' and new.mode='ranked')
  execute function private.omok_after_ranked_finished();

create function public.join_omok_ranked_queue()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  my_rating integer;
  opponent record;
  active_game record;
  new_match uuid;
  black_user uuid;
  white_user uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from private.omok_rank_queue_lock where id=true for update;
  select id,mode into active_game from public.omok_matches
    where status='active' and actor in(black_id,white_id)
    order by created_at desc,id desc limit 1;
  if active_game.id is not null then
    if active_game.mode='ranked' then
      return jsonb_build_object('status','matched','matchId',active_game.id);
    end if;
    raise exception 'ACTIVE_CASUAL_MATCH';
  end if;
  insert into public.omok_ratings(user_id) values(actor) on conflict do nothing;
  select rating into my_rating from public.omok_ratings where user_id=actor;
  if my_rating is null then raise exception 'RATING_MISSING'; end if;
  delete from public.omok_ranked_queue
    where heartbeat_at<clock_timestamp()-interval '45 seconds';
  insert into public.omok_ranked_queue(user_id,rating_snapshot)
    values(actor,my_rating) on conflict(user_id) do update
    set heartbeat_at=clock_timestamp(),rating_snapshot=excluded.rating_snapshot;
  select q.user_id,q.rating_snapshot into opponent
    from public.omok_ranked_queue q
    where q.user_id<>actor and q.heartbeat_at>=clock_timestamp()-interval '45 seconds'
      and abs(q.rating_snapshot-my_rating)<=
        case when q.joined_at<clock_timestamp()-interval '30 seconds' then 400 else 200 end
      and not exists(select 1 from public.player_blocks b
        where (b.blocker_id=actor and b.blocked_id=q.user_id)
          or (b.blocker_id=q.user_id and b.blocked_id=actor))
      and not exists(select 1 from public.omok_matches m
        where m.status='active' and q.user_id in(m.black_id,m.white_id))
    order by abs(q.rating_snapshot-my_rating),q.joined_at,q.user_id
    limit 1 for update skip locked;
  if not found then
    return jsonb_build_object('status','queued','matchId',null);
  end if;
  -- A second joiner is not permanently assigned white: alternate randomly.
  if random()<0.5 then
    black_user:=actor; white_user:=opponent.user_id;
  else
    black_user:=opponent.user_id; white_user:=actor;
  end if;
  insert into public.omok_matches(mode,room_id,black_id,white_id,turn_user_id,board_state)
    values('ranked',null,black_user,white_user,black_user,
      to_jsonb(array_fill(null::text,array[15,15])))
    returning id into new_match;
  delete from public.omok_ranked_queue where user_id in(actor,opponent.user_id);
  return jsonb_build_object('status','matched','matchId',new_match);
end;
$$;

create function public.cancel_omok_ranked_queue()
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from private.omok_rank_queue_lock where id=true for update;
  delete from public.omok_ranked_queue where user_id=actor;
  return true;
end;
$$;

create function public.omok_ranked_queue_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); match_id uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select id into match_id from public.omok_matches
    where mode='ranked' and status='active' and actor in(black_id,white_id)
    order by created_at desc,id desc limit 1;
  if match_id is not null then
    return jsonb_build_object('status','matched','matchId',match_id); end if;
  if exists(select 1 from public.omok_ranked_queue
    where user_id=actor and heartbeat_at>=now()-interval '45 seconds') then
    return jsonb_build_object('status','queued','matchId',null); end if;
  return jsonb_build_object('status','idle','matchId',null);
end;
$$;

create function public.omok_ranked_dashboard()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); personal_rating integer; leaders jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select rating into personal_rating from public.omok_ratings where user_id=actor;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.position),'[]'::jsonb) into leaders
  from (
    select row_number() over(order by r.rating desc,r.wins desc,r.user_id) as position,
      p.nickname,r.rating,r.wins,r.losses,r.draws
    from public.omok_ratings r join public.profiles p on p.id=r.user_id
    order by r.rating desc,r.wins desc,r.user_id limit 50
  ) t;
  return jsonb_build_object('rating',coalesce(personal_rating,1000),'leaderboard',leaders);
end;
$$;

create function public.expire_omok_ranked_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); game public.omok_matches%rowtype; winner uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into game from public.omok_matches where id=p_match_id for update;
  if not found or game.mode<>'ranked' or actor not in(game.black_id,game.white_id) then
    raise exception 'MATCH_NOT_FOUND'; end if;
  if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
  if game.turn_deadline is null or game.turn_deadline>clock_timestamp() then
    raise exception 'TURN_NOT_EXPIRED'; end if;
  winner:=case when game.turn_user_id=game.black_id then game.white_id else game.black_id end;
  update public.omok_matches set status='finished',winner_id=winner,
    finish_reason='timeout',finished_at=now() where id=p_match_id;
  return jsonb_build_object('winnerId',winner,'finishReason','timeout');
end;
$$;

revoke all on function public.join_omok_ranked_queue() from public,anon,authenticated;
revoke all on function public.cancel_omok_ranked_queue() from public,anon,authenticated;
revoke all on function public.omok_ranked_queue_status() from public,anon,authenticated;
revoke all on function public.omok_ranked_dashboard() from public,anon,authenticated;
revoke all on function public.expire_omok_ranked_match(uuid) from public,anon,authenticated;
grant execute on function public.join_omok_ranked_queue() to authenticated;
grant execute on function public.cancel_omok_ranked_queue() to authenticated;
grant execute on function public.omok_ranked_queue_status() to authenticated;
grant execute on function public.omok_ranked_dashboard() to authenticated;
grant execute on function public.expire_omok_ranked_match(uuid) to authenticated;

alter publication supabase_realtime add table public.omok_ratings;
commit;
