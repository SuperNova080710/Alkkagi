begin;

-- Player profile discovery is separate from the existing profiles row, ranking
-- and nickname workflows. Never expose auth.users/email or change Elo.
create table public.player_profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discoverable boolean not null default true,
  show_ranked_stats boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.player_profile_settings enable row level security;
revoke all on public.player_profile_settings from public, anon, authenticated;
grant select on public.player_profile_settings to authenticated;
grant all on public.player_profile_settings to service_role;

create policy player_profile_settings_read_self
  on public.player_profile_settings for select to authenticated
  using (user_id = (select auth.uid()));

-- Missing settings preserve the existing visible nickname/ranking behaviour.
-- A setting is never permission to SELECT someone else's profiles table row.
create function public.get_my_player_profile_settings()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  settings record;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles p where p.id=actor) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  select s.discoverable,s.show_ranked_stats,s.updated_at into settings
    from public.player_profile_settings s where s.user_id=actor;
  return jsonb_build_object(
    'discoverable',coalesce(settings.discoverable,true),
    'showRankedStats',coalesce(settings.show_ranked_stats,true)
  );
end;
$$;

create function public.set_my_player_profile_settings(
  p_discoverable boolean, p_show_ranked_stats boolean
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_discoverable is null or p_show_ranked_stats is null then
    raise exception 'INVALID_SETTINGS';
  end if;
  if not exists (select 1 from public.profiles p where p.id=actor) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  insert into public.player_profile_settings(user_id,discoverable,show_ranked_stats)
  values(actor,p_discoverable,p_show_ranked_stats)
  on conflict(user_id) do update
    set discoverable=excluded.discoverable,
        show_ranked_stats=excluded.show_ranked_stats,
        updated_at=now();
  return jsonb_build_object('discoverable',p_discoverable,'showRankedStats',p_show_ranked_stats);
end;
$$;

-- Authenticated-only discovery. Matching uses strpos, so "_" and "%" are
-- literal data rather than LIKE wildcards. At least two characters are required.
create function public.search_player_profiles(p_query text, p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid:=auth.uid();
  needle text:=btrim(p_query);
  output jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if needle is null or needle !~ '^[A-Za-z0-9_가-힣]{2,24}$' then
    raise exception 'INVALID_PLAYER_QUERY';
  end if;
  if p_limit is null or p_limit<1 or p_limit>20 then
    raise exception 'INVALID_PLAYER_LIMIT';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'nickname',x.nickname)
     order by x.prefix_hit desc,x.nickname_sort,x.id),'[]'::jsonb)
    into output
  from (
    select p.id,p.nickname,lower(p.nickname) as nickname_sort,
      (left(lower(p.nickname),char_length(needle))=lower(needle)) as prefix_hit
    from public.profiles p
    left join public.player_profile_settings s on s.user_id=p.id
    where (p.id=actor or coalesce(s.discoverable,true))
      and strpos(lower(p.nickname),lower(needle))>0
    order by prefix_hit desc,nickname_sort,p.id
    limit p_limit
  ) x;
  return output;
end;
$$;

-- Return ONLY the published fields. A private profile is indistinguishable
-- from a non-existent account to anyone but its owner. Individual ranked
-- results, email, profile creation time and other private data are excluded.
create function public.get_public_player_profile(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid:=auth.uid();
  player public.profiles%rowtype;
  visible boolean;
  share_stats boolean;
  player_rank bigint;
  rank_info jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_player_id is null then raise exception 'INVALID_PLAYER_ID'; end if;
  select p.* into player from public.profiles p where p.id=p_player_id;
  if not found then return null; end if;

  select coalesce(s.discoverable,true),coalesce(s.show_ranked_stats,true)
    into visible,share_stats
    from (select 1) row_anchor
    left join public.player_profile_settings s on s.user_id=p_player_id;
  if p_player_id<>actor and not visible then return null; end if;

  if p_player_id=actor or share_stats then
    select count(*)+1 into player_rank
      from public.profiles p
      where p.rating>player.rating
         or (p.rating=player.rating and p.id<player.id);
    rank_info:=jsonb_build_object(
      'rating',player.rating,
      'rank',player_rank,
      'wins',player.ranked_wins,
      'losses',player.ranked_losses,
      'draws',player.ranked_draws,
      'matches',player.ranked_wins+player.ranked_losses+player.ranked_draws
    );
  else
    rank_info:=null;
  end if;

  return jsonb_build_object(
    'id',player.id,
    'nickname',player.nickname,
    'isSelf',(p_player_id=actor),
    'ranked',rank_info
  );
end;
$$;

-- SECURITY DEFINER needs explicit grants and an auth.uid guard inside each
-- function. Direct SELECT of other profile rows and direct settings writes
-- remain denied by RLS / table privileges.
revoke all on function public.get_my_player_profile_settings() from public,anon,authenticated;
revoke all on function public.set_my_player_profile_settings(boolean,boolean) from public,anon,authenticated;
revoke all on function public.search_player_profiles(text,integer) from public,anon,authenticated;
revoke all on function public.get_public_player_profile(uuid) from public,anon,authenticated;
grant execute on function public.get_my_player_profile_settings(),
  public.set_my_player_profile_settings(boolean,boolean),
  public.search_player_profiles(text,integer),
  public.get_public_player_profile(uuid) to authenticated;

commit;
