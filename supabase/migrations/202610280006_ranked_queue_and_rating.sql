begin;

-- P2: ranked queue serializes pair creation. Never accept client ratings.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.rank_queue_lock (
 id boolean primary key default true check(id)
);
insert into private.rank_queue_lock(id) values(true) on conflict do nothing;

alter table public.matches drop constraint if exists matches_mode_check;
alter table public.matches add constraint matches_mode_check check(mode in ('casual','ranked'));
alter table public.matches add constraint ranked_match_room_check
 check ((mode='ranked' and room_id is null) or (mode='casual' and room_id is not null));

alter table public.profiles add column ranked_draws integer not null default 0 check (ranked_draws>=0);
create table public.ranked_queue (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 rating_snapshot integer not null check (rating_snapshot>=0),
 joined_at timestamptz not null default now(),
 heartbeat_at timestamptz not null default now()
);
create index ranked_queue_eligible_idx on public.ranked_queue(heartbeat_at,joined_at);

create table public.rating_history (
 match_id uuid not null references public.matches(id),
 user_id uuid not null references public.profiles(id),
 before_rating integer not null check (before_rating >= 0),
 after_rating integer not null check (after_rating >= 0),
 delta integer not null,
 created_at timestamptz not null default now(),
 primary key (match_id,user_id),
 check (after_rating=before_rating+delta)
);
create index rating_history_user_idx on public.rating_history(user_id,created_at desc);

alter table public.ranked_queue enable row level security;
alter table public.rating_history enable row level security;
revoke all on public.ranked_queue,public.rating_history from public,anon,authenticated;
grant all on public.ranked_queue,public.rating_history to service_role;
grant select on public.rating_history to authenticated;
create policy rating_history_self on public.rating_history for select to authenticated
 using (user_id=(select auth.uid()));

-- Matches are serialized by the existing match row lock in shot/forfeit.
-- Internal function is not exposed by the Data API, and has no client grants.
create function private.settle_ranked_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
 m public.matches%rowtype;
 p1 public.profiles%rowtype;
 p2 public.profiles%rowtype;
 score1 numeric;
 expected1 numeric;
 change1 integer;
 after1 integer;
 after2 integer;
begin
 select * into m from public.matches where id=p_match_id for update;
 if not found or m.mode<>'ranked' or m.status<>'finished' then return; end if;
 if exists(select 1 from public.rating_history where match_id=m.id) then return; end if;
 -- Stable lock order prevents concurrent player-rating update deadlocks.
 perform 1 from public.profiles where id in(m.player1_id,m.player2_id) order by id for update;
 select * into p1 from public.profiles where id=m.player1_id;
 select * into p2 from public.profiles where id=m.player2_id;
 if p1.id is null or p2.id is null then raise exception 'PROFILE_MISSING'; end if;
 score1:=case when m.winner_id=m.player1_id then 1
              when m.winner_id=m.player2_id then 0 else 0.5 end;
 expected1:=1/(1+power(10::numeric,(p2.rating-p1.rating)/400.0));
 change1:=round(32*(score1-expected1))::integer;
 after1:=greatest(0,p1.rating+change1);
 after2:=greatest(0,p2.rating-change1);
 update public.profiles set rating=after1,
  ranked_wins=ranked_wins+case when score1=1 then 1 else 0 end,
  ranked_losses=ranked_losses+case when score1=0 then 1 else 0 end,
  ranked_draws=ranked_draws+case when score1=0.5 then 1 else 0 end
  where id=p1.id;
 update public.profiles set rating=after2,
  ranked_wins=ranked_wins+case when score1=0 then 1 else 0 end,
  ranked_losses=ranked_losses+case when score1=1 then 1 else 0 end,
  ranked_draws=ranked_draws+case when score1=0.5 then 1 else 0 end
  where id=p2.id;
 insert into public.rating_history(match_id,user_id,before_rating,after_rating,delta)
 values(m.id,p1.id,p1.rating,after1,after1-p1.rating),
       (m.id,p2.id,p2.rating,after2,after2-p2.rating);
end;
$$;
revoke all on function private.settle_ranked_match(uuid) from public,anon,authenticated,service_role;

create function public.join_ranked_queue()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=auth.uid();
 current_rating integer;
 opponent record;
 new_match uuid;
 pieces jsonb;
 active_id uuid;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from private.rank_queue_lock where id=true for update;
 select id into active_id from public.matches
  where status='active' and actor in(player1_id,player2_id)
  order by created_at desc limit 1;
 if active_id is not null then
  if (select mode from public.matches where id=active_id)='ranked' then
   return jsonb_build_object('status','matched','matchId',active_id);
  end if;
  raise exception 'ACTIVE_CASUAL_MATCH';
 end if;
 select rating into current_rating from public.profiles where id=actor;
 if current_rating is null then raise exception 'PROFILE_MISSING'; end if;
 delete from public.ranked_queue where heartbeat_at<now()-interval '45 seconds';
 -- Rejoining an existing queue is idempotent and refreshes its heartbeat.
 insert into public.ranked_queue(user_id,rating_snapshot,heartbeat_at)
  values(actor,current_rating,now())
  on conflict(user_id) do update set heartbeat_at=now(),rating_snapshot=excluded.rating_snapshot;
 select q.user_id,q.rating_snapshot into opponent
 from public.ranked_queue q
 where q.user_id<>actor
 and q.heartbeat_at>=now()-interval '45 seconds'
 and abs(q.rating_snapshot-current_rating) <= case
  when q.joined_at<now()-interval '30 seconds' then 400 else 200 end
 order by abs(q.rating_snapshot-current_rating),q.joined_at,q.user_id
 limit 1 for update skip locked;
 if not found then
  return jsonb_build_object('status','queued','matchId',null);
 end if;
 select jsonb_agg(jsonb_build_object('id',piece_id,'owner',owner,'x',x,'y',y) order by piece_id)
 into pieces from (
  select 'a'||n as piece_id,opponent.user_id as owner,175::float8 as x,
   (70+n*60)::float8 as y from generate_series(1,5) n
  union all
  select 'b'||n as piece_id,actor as owner,625::float8 as x,
   (70+n*60)::float8 as y from generate_series(1,5) n
 ) board;
 insert into public.matches(mode,player1_id,player2_id,turn_user_id,board_state)
 values('ranked',opponent.user_id,actor,opponent.user_id,jsonb_build_object('pieces',pieces))
 returning id into new_match;
 delete from public.ranked_queue where user_id in(actor,opponent.user_id);
 return jsonb_build_object('status','matched','matchId',new_match);
end;
$$;

create function public.ranked_queue_status()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=auth.uid();
 active_id uuid;
 is_queued boolean;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select id into active_id from public.matches
  where mode='ranked' and status='active' and actor in(player1_id,player2_id)
  order by created_at desc limit 1;
 if active_id is not null then
  return jsonb_build_object('status','matched','matchId',active_id);
 end if;
 update public.ranked_queue set heartbeat_at=now() where user_id=actor;
 is_queued:=found;
 return jsonb_build_object('status',case when is_queued then 'queued' else 'idle' end,
   'matchId',null);
end;
$$;

create function public.cancel_ranked_queue()
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from private.rank_queue_lock where id=true for update;
 delete from public.ranked_queue where user_id=actor;
 return true;
end;
$$;

-- Only the two participants may request full match data or opponent nicknames.
create function public.ranked_match_players(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select jsonb_build_array(
  jsonb_build_object('seat',1,'nickname',p1.nickname),
  jsonb_build_object('seat',2,'nickname',p2.nickname))
 into result from public.matches m
 join public.profiles p1 on p1.id=m.player1_id
 join public.profiles p2 on p2.id=m.player2_id
 where m.id=p_match_id and m.mode='ranked'
   and actor in(m.player1_id,m.player2_id);
 if result is null then raise exception 'MATCH_NOT_FOUND'; end if;
 return result;
end;
$$;

create function public.ranked_dashboard()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); info public.profiles%rowtype; rank integer; leader jsonb; history jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into info from public.profiles where id=actor;
 if not found then raise exception 'PROFILE_MISSING'; end if;
 select count(*)+1 into rank from public.profiles p
  where p.rating>info.rating or (p.rating=info.rating and p.id<actor);
 select coalesce(jsonb_agg(to_jsonb(t) order by t.position),'[]'::jsonb) into leader from (
  select row_number() over(order by p.rating desc,p.id asc)::integer as position,
   p.nickname,p.rating,p.ranked_wins as wins,p.ranked_losses as losses,p.ranked_draws as draws
  from public.profiles p order by p.rating desc,p.id asc limit 100
 ) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.finished_at desc),'[]'::jsonb) into history from (
  select m.id as "matchId",m.finished_at,
    opp.nickname as opponent,
    case when m.winner_id is null then 'draw'
         when m.winner_id=actor then 'win' else 'loss' end as result,
    h.delta,h.after_rating as "ratingAfter"
  from public.matches m
  join public.profiles opp on opp.id=case when m.player1_id=actor then m.player2_id else m.player1_id end
  left join public.rating_history h on h.match_id=m.id and h.user_id=actor
  where m.mode='ranked' and m.status='finished' and actor in(m.player1_id,m.player2_id)
  order by m.finished_at desc,m.id desc limit 20
 ) t;
 return jsonb_build_object('rating',info.rating,'rank',rank,'wins',info.ranked_wins,
  'losses',info.ranked_losses,'draws',info.ranked_draws,
  'leaderboard',leader,'history',history);
end;
$$;

revoke all on function public.join_ranked_queue() from public,anon;
revoke all on function public.ranked_queue_status() from public,anon;
revoke all on function public.cancel_ranked_queue() from public,anon;
revoke all on function public.ranked_match_players(uuid) from public,anon;
revoke all on function public.ranked_dashboard() from public,anon;
grant execute on function public.join_ranked_queue(),public.ranked_queue_status(),
 public.cancel_ranked_queue(),public.ranked_match_players(uuid),public.ranked_dashboard()
 to authenticated;

-- Avoid missing the match start/settlement when a Realtime message is lost.
-- Existing matches publication already includes newly inserted ranked rows.
commit;
