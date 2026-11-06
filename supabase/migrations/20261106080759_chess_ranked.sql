begin;

alter table public.chess_matches alter column room_id drop not null;
alter table public.chess_matches add column mode text not null default 'casual';
alter table public.chess_matches add column turn_deadline timestamptz;
alter table public.chess_matches add constraint chess_match_mode_check check (
  (mode='casual' and room_id is not null and turn_deadline is null)
  or (mode='ranked' and room_id is null and (turn_deadline is null)=(finished_at is not null))
);
alter table public.chess_matches drop constraint chess_matches_finish_reason_check;
alter table public.chess_matches drop constraint chess_matches_check3;
alter table public.chess_matches add constraint chess_match_finish_reason_check check (
  finish_reason in ('checkmate','stalemate','insufficient-material','threefold-repetition','fifty-move-rule','resignation','timeout')
);
alter table public.chess_matches add constraint chess_match_winner_check check (
  (winner_id is not null)=coalesce(finish_reason in ('checkmate','resignation','timeout'),false)
);
create index chess_ranked_white_active on public.chess_matches(white_id) where mode='ranked' and finished_at is null;
create index chess_ranked_black_active on public.chess_matches(black_id) where mode='ranked' and finished_at is null;

create table public.chess_ratings (
  user_id uuid primary key references public.profiles(id),
  rating integer not null default 1000 check (rating>=0),
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0
);
create table public.chess_queue (
  user_id uuid primary key references public.profiles(id),
  joined_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);
create table public.chess_rating_events (
  match_id uuid not null references public.chess_matches(id),
  user_id uuid not null references public.profiles(id),
  delta integer not null,
  rating_after integer not null,
  primary key(match_id,user_id)
);
alter table public.chess_ratings enable row level security;
alter table public.chess_queue enable row level security;
alter table public.chess_rating_events enable row level security;
revoke all on public.chess_ratings,public.chess_queue,public.chess_rating_events from public,anon,authenticated,service_role;
grant select,insert,update on public.chess_ratings to service_role;
grant select,insert,update,delete on public.chess_queue to service_role;
grant select,insert on public.chess_rating_events to service_role;

create function private.chess_ranked_clock() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.mode<>'ranked' then return new; end if;
  if tg_op='UPDATE' then
    if old.finished_at is null and old.turn_deadline<=clock_timestamp()
        and new.finish_reason is distinct from 'timeout' then
      raise exception 'TURN_EXPIRED';
    end if;
  end if;
  new.turn_deadline:=case when new.finished_at is null then clock_timestamp()+interval '90 seconds' end;
  return new;
end;
$$;
create trigger chess_ranked_clock before insert or update of ply,finished_at on public.chess_matches
  for each row execute function private.chess_ranked_clock();

create function private.chess_ranked_settle() returns trigger
language plpgsql set search_path='' as $$
declare w integer; b integer; delta integer; score numeric;
begin
  if new.mode<>'ranked' or old.finished_at is not null or new.finished_at is null then return new; end if;
  perform 1 from public.chess_ratings where user_id in(new.white_id,new.black_id) order by user_id for update;
  select rating into strict w from public.chess_ratings where user_id=new.white_id;
  select rating into strict b from public.chess_ratings where user_id=new.black_id;
  score:=case when new.winner_id is null then .5 when new.winner_id=new.white_id then 1 else 0 end;
  delta:=round(32*(score-1/(1+power(10::numeric,(b-w)/400.0))));
  delta:=greatest(-w,least(b,delta));
  update public.chess_ratings set rating=rating+delta,
    wins=wins+(score=1)::int, losses=losses+(score=0)::int, draws=draws+(score=.5)::int
    where user_id=new.white_id;
  update public.chess_ratings set rating=rating-delta,
    wins=wins+(score=0)::int, losses=losses+(score=1)::int, draws=draws+(score=.5)::int
    where user_id=new.black_id;
  insert into public.chess_rating_events values
    (new.id,new.white_id,delta,w+delta),(new.id,new.black_id,-delta,b-delta);
  return new;
end;
$$;
create trigger chess_ranked_settle after update of finished_at on public.chess_matches
  for each row execute function private.chess_ranked_settle();

create function public.chess_ranked_queue(p_actor uuid,p_action text)
returns jsonb language plpgsql set search_path='' as $$
declare active_id uuid; opponent uuid; my_rating integer;
begin
  if p_actor is null or p_action not in ('status','join','cancel') then raise exception 'INVALID_REQUEST'; end if;
  if p_action<>'status' then perform pg_advisory_xact_lock(40,315); end if;
  select id into active_id from public.chess_matches where mode='ranked' and finished_at is null
    and p_actor in(white_id,black_id) limit 1;
  if active_id is not null then return jsonb_build_object('status','matched','matchId',active_id); end if;
  if p_action='cancel' then
    delete from public.chess_queue where user_id=p_actor;
  elsif p_action='join' then
    if not exists(select 1 from public.profiles where id=p_actor) then raise exception 'PROFILE_MISSING'; end if;
    delete from public.chess_queue where heartbeat_at<=clock_timestamp()-interval '45 seconds';
    insert into public.chess_ratings(user_id) values(p_actor) on conflict do nothing;
    select rating into my_rating from public.chess_ratings where user_id=p_actor;
    insert into public.chess_queue(user_id,heartbeat_at) values(p_actor,clock_timestamp())
      on conflict(user_id) do update set heartbeat_at=excluded.heartbeat_at;
    select q.user_id into opponent
    from public.chess_queue q join public.chess_ratings r on r.user_id=q.user_id
    where q.user_id<>p_actor
      and not exists (select 1 from public.player_blocks b
        where (b.blocker_id=p_actor and b.blocked_id=q.user_id) or (b.blocker_id=q.user_id and b.blocked_id=p_actor))
    order by abs(r.rating-my_rating),q.joined_at,q.user_id limit 1;
    if opponent is not null then
      if random()<.5 then
        insert into public.chess_matches(mode,white_id,black_id) values('ranked',p_actor,opponent) returning id into active_id;
      else
        insert into public.chess_matches(mode,white_id,black_id) values('ranked',opponent,p_actor) returning id into active_id;
      end if;
      delete from public.chess_queue where user_id in(p_actor,opponent);
      return jsonb_build_object('status','matched','matchId',active_id);
    end if;
  end if;
  return jsonb_build_object('status',case when exists(select 1 from public.chess_queue where user_id=p_actor
    and heartbeat_at>clock_timestamp()-interval '45 seconds') then 'queued' else 'idle' end,'matchId',null);
end;
$$;

create function public.chess_expire_ranked(p_actor uuid,p_match_id uuid)
returns void language plpgsql set search_path='' as $$
declare game public.chess_matches%rowtype;
begin
  select * into game from public.chess_matches where id=p_match_id for update;
  if not found or p_actor is null or p_actor not in(game.white_id,game.black_id) then raise exception 'MATCH_NOT_FOUND'; end if;
  if game.mode<>'ranked' or game.finished_at is not null or game.turn_deadline>clock_timestamp() then return; end if;
  update public.chess_matches set finished_at=clock_timestamp(),finish_reason='timeout',
    winner_id=case when game.ply%2=0 then game.black_id else game.white_id end where id=game.id;
end;
$$;

create function public.chess_ranked_dashboard(p_actor uuid)
returns jsonb language sql stable set search_path='' as $$
  with ranked as (
    select r.*,p.nickname,row_number() over(order by r.rating desc,r.wins desc,r.user_id) as position
    from public.chess_ratings r join public.profiles p on p.id=r.user_id
  )
  select jsonb_build_object('rating',coalesce(m.rating,1000),'rank',coalesce(m.position,0),
    'wins',coalesce(m.wins,0),'losses',coalesce(m.losses,0),'draws',coalesce(m.draws,0),
    'leaderboard',coalesce((select jsonb_agg(
      jsonb_build_object('position',position,'nickname',nickname,'rating',rating) order by position
    ) from ranked where position<=100),'[]'::jsonb),'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.finished_at desc) from (
      select g.id as "matchId",g.finished_at,p.nickname as opponent,
        case when g.winner_id is null then 'draw' when g.winner_id=p_actor then 'win' else 'loss' end as result,
        e.delta,e.rating_after as "ratingAfter"
      from public.chess_rating_events e join public.chess_matches g on g.id=e.match_id
      join public.profiles p on p.id=case when g.white_id=p_actor then g.black_id else g.white_id end
      where e.user_id=p_actor order by g.finished_at desc limit 10
    ) h),'[]'::jsonb))
  from (select 1) seed left join ranked m on m.user_id=p_actor
$$;

revoke all on function private.chess_ranked_clock(),private.chess_ranked_settle() from public,anon,authenticated,service_role;
revoke all on function public.chess_ranked_queue(uuid,text),public.chess_expire_ranked(uuid,uuid),
  public.chess_ranked_dashboard(uuid) from public,anon,authenticated,service_role;
grant execute on function public.chess_ranked_queue(uuid,text),public.chess_expire_ranked(uuid,uuid),
  public.chess_ranked_dashboard(uuid) to service_role;

commit;
