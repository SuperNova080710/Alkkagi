begin;

alter table public.xp_events drop constraint xp_events_source_kind_check;
alter table public.xp_events add constraint xp_events_source_kind_check
  check(source_kind in('casual','ranked','ai','omok_casual','omok_ranked','omok_ai','chess_casual','chess_ranked'));

-- Count all three online games against the same daily and casual-opponent caps.
create or replace function private.record_match_xp(
  p_kind text,p_source uuid,p_user uuid,p_opponent uuid,
  p_outcome text,p_reward integer
) returns void language plpgsql security definer set search_path=''
as $shared_xp$
declare
  recorded_at timestamptz:=clock_timestamp();
  start_utc timestamptz:=date_trunc('day',recorded_at at time zone 'UTC') at time zone 'UTC';
  awarded integer:=p_reward;
  inserted bigint;
begin
  -- Called exclusively by table transition triggers. Keep zero-XP events for
  -- deduplication and audit, including capped matches.
  if p_kind in('ai','omok_ai') then
    if (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('ai','omok_ai')
          and e.created_at>=start_utc)>=10 then awarded:=0; end if;
  else
    if (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('casual','ranked','omok_casual','omok_ranked','chess_casual','chess_ranked')
          and e.created_at>=start_utc)>=20 then awarded:=0; end if;
    if p_kind in('casual','omok_casual','chess_casual') and
       (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('casual','omok_casual','chess_casual')
          and e.opponent_id=p_opponent and e.created_at>=start_utc)>=5
    then awarded:=0; end if;
  end if;

  insert into public.xp_events(user_id,source_kind,source_id,opponent_id,outcome,xp_amount,created_at)
    values(p_user,p_kind,p_source,p_opponent,p_outcome,awarded,recorded_at)
    on conflict(source_kind,source_id,user_id) do nothing returning id into inserted;
  if inserted is not null and awarded>0 then
    insert into public.player_progress(user_id,total_xp)
      values(p_user,awarded)
      on conflict(user_id) do update set total_xp=public.player_progress.total_xp+excluded.total_xp,
        updated_at=now();
  end if;
end;
$shared_xp$;

create or replace function private.record_omok_xp(
  p_kind text,p_source uuid,p_user uuid,p_opponent uuid,
  p_outcome text,p_reward integer
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_kind not in('omok_casual','omok_ranked','omok_ai')
    or p_source is null or p_user is null
    or p_outcome not in('win','loss','draw') or p_reward not between 0 and 100 then
    raise exception 'INVALID_XP_EVENT';
  end if;
  perform private.record_match_xp(p_kind,p_source,p_user,p_opponent,p_outcome,p_reward);
end;
$$;

create function private.after_chess_match_finished_xp()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  white_outcome text;
  black_outcome text;
  gain_win integer;
  gain_loss integer;
  gain_draw integer;
  kind text;
begin
  -- The same ordered locks used by Alkkagi and Omok serialize shared XP caps.
  perform 1 from public.profiles where id in(new.white_id,new.black_id) order by id for update;
  if new.mode='ranked' then
    kind:='chess_ranked'; gain_win:=70; gain_loss:=35; gain_draw:=50;
  else
    kind:='chess_casual'; gain_win:=40; gain_loss:=20; gain_draw:=25;
  end if;

  white_outcome:=case when new.winner_id is null then 'draw'
    when new.winner_id=new.white_id then 'win' else 'loss' end;
  black_outcome:=case when new.winner_id is null then 'draw'
    when new.winner_id=new.black_id then 'win' else 'loss' end;
  perform private.record_match_xp(kind,new.id,new.white_id,new.black_id,white_outcome,
    case white_outcome when 'win' then gain_win when 'loss' then gain_loss else gain_draw end);
  perform private.record_match_xp(kind,new.id,new.black_id,new.white_id,black_outcome,
    case black_outcome when 'win' then gain_win when 'loss' then gain_loss else gain_draw end);
  return new;
end;
$$;
revoke all on function private.after_chess_match_finished_xp() from public,anon,authenticated,service_role;

create trigger xp_chess_match_finished
  after update of finished_at on public.chess_matches
  for each row when (old.finished_at is null and new.finished_at is not null)
  execute function private.after_chess_match_finished_xp();

commit;
