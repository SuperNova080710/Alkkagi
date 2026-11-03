begin;

-- v0.3.0 Omok XP integration (#223), optional only after existing XP 008.
-- Existing Alkkagi XP triggers/rating are unchanged.
alter table public.xp_events drop constraint if exists xp_events_source_kind_check;
alter table public.xp_events add constraint xp_events_source_kind_check
  check(source_kind in('casual','ranked','ai',
    'omok_casual','omok_ranked','omok_ai'));

-- Keep the legacy Alkkagi XP caps symmetric with Omok awards.
create or replace function private.record_match_xp(
  p_kind text,p_source uuid,p_user uuid,p_opponent uuid,
  p_outcome text,p_reward integer
) returns void language plpgsql security definer set search_path=''
as $legacy_xp$
declare
  start_utc timestamptz := date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  awarded integer:=p_reward;
  inserted bigint;
begin
  -- Called exclusively by table transition triggers. Keep zero-XP events for
  -- deduplication and audit, including capped matches.
  if p_kind='ai' then
    if (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('ai','omok_ai')
          and e.created_at>=start_utc)>=10 then awarded:=0; end if;
  else
    if (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('casual','ranked','omok_casual','omok_ranked')
          and e.created_at>=start_utc)>=20 then awarded:=0; end if;
    if p_kind='casual' and
       (select count(*) from public.xp_events e
        where e.user_id=p_user and e.source_kind in('casual','omok_casual')
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
$legacy_xp$;

create function private.record_omok_xp(
  p_kind text,p_source uuid,p_user uuid,p_opponent uuid,
  p_outcome text,p_reward integer
) returns void language plpgsql security definer set search_path='' as $$
declare
  start_utc timestamptz:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  awarded integer:=p_reward;
  inserted bigint;
begin
  if p_kind not in('omok_casual','omok_ranked','omok_ai')
    or p_source is null or p_user is null
    or p_outcome not in('win','loss','draw') or p_reward not between 0 and 100 then
    raise exception 'INVALID_XP_EVENT'; end if;
  if p_kind='omok_ai' then
    if (select count(*) from public.xp_events e
      where e.user_id=p_user and e.source_kind in('ai','omok_ai')
        and e.created_at>=start_utc)>=10 then awarded:=0; end if;
  else
    -- Shared daily cap across both games. Existing Alkkagi awards maintain
    -- their original cap policy, while Omok cannot grow rewards beyond it.
    if (select count(*) from public.xp_events e
      where e.user_id=p_user
        and e.source_kind in('casual','ranked','omok_casual','omok_ranked')
        and e.created_at>=start_utc)>=20 then awarded:=0; end if;
    if p_kind='omok_casual' and
      (select count(*) from public.xp_events e
        where e.user_id=p_user and e.opponent_id=p_opponent
          and e.source_kind in('casual','omok_casual')
          and e.created_at>=start_utc)>=5 then awarded:=0; end if;
  end if;
  insert into public.xp_events(user_id,source_kind,source_id,opponent_id,outcome,xp_amount)
    values(p_user,p_kind,p_source,p_opponent,p_outcome,awarded)
    on conflict(source_kind,source_id,user_id) do nothing returning id into inserted;
  if inserted is not null and awarded>0 then
    insert into public.player_progress(user_id,total_xp)
      values(p_user,awarded)
      on conflict(user_id) do update
        set total_xp=public.player_progress.total_xp+excluded.total_xp,
            updated_at=now();
  end if;
end;
$$;
revoke all on function private.record_omok_xp(text,uuid,uuid,uuid,text,integer)
  from public,anon,authenticated,service_role;

create function private.after_omok_pvp_finished_xp()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  outcome_black text; outcome_white text;
  gain_win integer; gain_loss integer; gain_draw integer;
  kind text;
begin
  if old.status<>'active' or new.status<>'finished' then return new; end if;
  if new.mode='ranked' then
    gain_win:=70;gain_loss:=35;gain_draw:=50;kind:='omok_ranked';
  else
    gain_win:=40;gain_loss:=20;gain_draw:=25;kind:='omok_casual';
  end if;
  -- Account XP, not Elo. Serialize two profile changes in stable order.
  perform 1 from public.profiles
    where id in(new.black_id,new.white_id) order by id for update;
  outcome_black:=case when new.winner_id=new.black_id then 'win'
    when new.winner_id=new.white_id then 'loss' else 'draw' end;
  outcome_white:=case when new.winner_id=new.white_id then 'win'
    when new.winner_id=new.black_id then 'loss' else 'draw' end;
  perform private.record_omok_xp(kind,new.id,new.black_id,new.white_id,
    outcome_black,case outcome_black when 'win' then gain_win
    when 'loss' then gain_loss else gain_draw end);
  perform private.record_omok_xp(kind,new.id,new.white_id,new.black_id,
    outcome_white,case outcome_white when 'win' then gain_win
    when 'loss' then gain_loss else gain_draw end);
  return new;
end;
$$;
revoke all on function private.after_omok_pvp_finished_xp()
  from public,anon,authenticated,service_role;

create function private.after_omok_ai_finished_xp()
returns trigger language plpgsql security definer set search_path='' as $$
declare result text; gain integer;
begin
  if old.status<>'active' or new.status<>'finished' then return new; end if;
  perform 1 from public.profiles where id=new.owner_id for update;
  result:=case when new.winner='human' then 'win'
    when new.winner='ai' then 'loss' else 'draw' end;
  gain:=case when result='win'
    then case new.difficulty when 'easy' then 10
      when 'normal' then 15 else 20 end
    else 0 end;
  perform private.record_omok_xp('omok_ai',new.id,new.owner_id,null,result,gain);
  return new;
end;
$$;
revoke all on function private.after_omok_ai_finished_xp()
  from public,anon,authenticated,service_role;

create trigger xp_omok_pvp_finished
  after update of status on public.omok_matches
  for each row when(old.status='active' and new.status='finished')
  execute function private.after_omok_pvp_finished_xp();
create trigger xp_omok_ai_finished
  after update of status on public.omok_ai_matches
  for each row when(old.status='active' and new.status='finished')
  execute function private.after_omok_ai_finished_xp();

commit;
