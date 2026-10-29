begin;

-- XP V1 (#105/#106): independent of ranked rating and existing game RPCs.
-- Only new active -> finished transitions are awarded; no historical backfill.
create table public.player_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_xp bigint not null default 0 check(total_xp>=0),
  updated_at timestamptz not null default now()
);
create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_kind text not null check(source_kind in('casual','ranked','ai')),
  source_id uuid not null,
  opponent_id uuid references public.profiles(id) on delete set null,
  outcome text not null check(outcome in('win','loss','draw')),
  xp_amount integer not null check(xp_amount>=0 and xp_amount<=100),
  created_at timestamptz not null default now(),
  unique(source_kind,source_id,user_id)
);
create index xp_events_user_recent_idx on public.xp_events(user_id,created_at desc,id desc);
create index xp_events_user_daily_idx on public.xp_events(user_id,source_kind,created_at desc);
create index xp_events_casual_opponent_idx on public.xp_events(user_id,opponent_id,created_at desc)
  where source_kind='casual';
alter table public.player_progress enable row level security;
alter table public.xp_events enable row level security;
revoke all on public.player_progress,public.xp_events from public,anon,authenticated;
grant select on public.player_progress,public.xp_events to authenticated;
grant all on public.player_progress,public.xp_events to service_role;
create policy player_progress_read_self on public.player_progress
  for select to authenticated using (user_id=(select auth.uid()));
create policy xp_events_read_self on public.xp_events
  for select to authenticated using (user_id=(select auth.uid()));
-- No user write grants/policies. The game service never sends an XP amount.

create function private.record_match_xp(
  p_kind text,p_source uuid,p_user uuid,p_opponent uuid,
  p_outcome text,p_reward integer
) returns void language plpgsql security definer set search_path=''
as $$
declare
  start_utc timestamptz := date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  awarded integer:=p_reward;
  inserted bigint;
begin
  -- Called exclusively by table transition triggers. Keep zero-XP events for
  -- deduplication and audit, including capped matches.
  if p_kind='ai' then
    if (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind='ai'
          and e.created_at>=start_utc)>=10 then awarded:=0; end if;
  else
    if (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('casual','ranked')
          and e.created_at>=start_utc)>=20 then awarded:=0; end if;
    if p_kind='casual' and
       (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind='casual'
          and e.opponent_id=p_opponent and e.created_at>=start_utc)>=5
    then awarded:=0; end if;
  end if;

  insert into public.xp_events(user_id,source_kind,source_id,opponent_id,outcome,xp_amount)
    values(p_user,p_kind,p_source,p_opponent,p_outcome,awarded)
    on conflict(source_kind,source_id,user_id) do nothing returning id into inserted;
  if inserted is not null and awarded>0 then
    insert into public.player_progress(user_id,total_xp)
      values(p_user,awarded)
      on conflict(user_id) do update set total_xp=public.player_progress.total_xp+excluded.total_xp,
        updated_at=now();
  end if;
end;
$$;
revoke all on function private.record_match_xp(text,uuid,uuid,uuid,text,integer)
  from public,anon,authenticated,service_role;

create function private.after_pvp_match_finished_xp()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  first_result text;
  second_result text;
  gain_win integer;
  gain_loss integer;
  gain_draw integer;
begin
  if old.status<>'active' or new.status<>'finished' then return new; end if;
  -- Serialise profile updates for matches finishing concurrently. This also
  -- agrees with the ranked rating-settlement profile lock ordering.
  perform 1 from public.profiles
    where id in(new.player1_id,new.player2_id) order by id for update;
  if new.mode='ranked' then
    gain_win:=70; gain_loss:=35; gain_draw:=50;
  else
    gain_win:=40; gain_loss:=20; gain_draw:=25;
  end if;
  first_result:=case when new.winner_id=new.player1_id then 'win'
    when new.winner_id=new.player2_id then 'loss' else 'draw' end;
  second_result:=case when new.winner_id=new.player2_id then 'win'
    when new.winner_id=new.player1_id then 'loss' else 'draw' end;
  perform private.record_match_xp(new.mode,new.id,new.player1_id,new.player2_id,
    first_result,case first_result when 'win' then gain_win when 'loss' then gain_loss else gain_draw end);
  perform private.record_match_xp(new.mode,new.id,new.player2_id,new.player1_id,
    second_result,case second_result when 'win' then gain_win when 'loss' then gain_loss else gain_draw end);
  return new;
end;
$$;
revoke all on function private.after_pvp_match_finished_xp()
  from public,anon,authenticated,service_role;

create function private.after_ai_match_finished_xp()
returns trigger language plpgsql security definer set search_path=''
as $$
declare gain integer; result text;
begin
  if old.status<>'active' or new.status<>'finished' then return new; end if;
  perform 1 from public.profiles where id=new.owner_id for update;
  result:=case when new.winner_id=new.owner_id then 'win' else 'loss' end;
  gain:=case when result='win' then
    case new.difficulty when 'easy' then 10 when 'normal' then 15 else 20 end
    else 0 end;
  perform private.record_match_xp('ai',new.room_id,new.owner_id,null,result,gain);
  return new;
end;
$$;
revoke all on function private.after_ai_match_finished_xp()
  from public,anon,authenticated,service_role;

create trigger xp_pvp_match_finished
  after update of status on public.matches
  for each row when (old.status='active' and new.status='finished')
  execute function private.after_pvp_match_finished_xp();

create trigger xp_ai_match_finished
  after update of status on public.ai_matches
  for each row when (old.status='active' and new.status='finished')
  execute function private.after_ai_match_finished_xp();

-- Explicit, guarded read API: self gets recent events, other players get
-- totals only if their public profile is discoverable.
create function public.get_player_experience(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  total bigint;
  lvl integer;
  earliest bigint;
  next_target bigint;
  events jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_player_id is null then raise exception 'INVALID_PLAYER_ID'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_player_id) then
    return null;
  end if;
  if p_player_id<>actor and exists (
    select 1 from public.player_profile_settings s
    where s.user_id=p_player_id and s.discoverable=false
  ) then return null; end if;

  select coalesce(p.total_xp,0) into total from (select 1) a
    left join public.player_progress p on p.user_id=p_player_id;
  lvl:=floor(sqrt(total::numeric/100))::integer+1;
  earliest:=100::bigint*(lvl-1)*(lvl-1);
  next_target:=100::bigint*lvl*lvl;

  if actor=p_player_id then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id::text,'sourceKind',x.source_kind,'sourceId',x.source_id,
      'outcome',x.outcome,'earnedXp',x.xp_amount,'createdAt',x.created_at)
      order by x.created_at desc,x.id desc),'[]'::jsonb)
      into events from (
      select e.id,e.source_kind,e.source_id,e.outcome,e.xp_amount,e.created_at
      from public.xp_events e where e.user_id=actor
      order by e.created_at desc,e.id desc limit 20
    ) x;
  else events:=null; end if;

  return jsonb_build_object(
    'userId',p_player_id,'totalXp',total,'level',lvl,
    'currentLevelXp',total-earliest,
    'nextLevelCost',next_target-earliest,
    'nextLevelAt',next_target,
    'recentRewards',events
  );
end;
$$;
revoke all on function public.get_player_experience(uuid) from public,anon,authenticated;
grant execute on function public.get_player_experience(uuid) to authenticated;

commit;
