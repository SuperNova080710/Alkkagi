begin;

-- Keep existing player_* usernames, ratings and match history untouched.
-- Database uniqueness is decisive even when two availability checks race.
alter table public.profiles
  add constraint profiles_nickname_format
  check (nickname ~ '^[A-Za-z0-9_가-힣]{2,24}$');

create unique index profiles_nickname_unique_ci
  on public.profiles ((lower(nickname)));

-- Availability is informative. save_my_nickname remains race-safe through
-- the PostgreSQL unique index, not the result of this earlier check.
create function public.check_nickname_available(p_nickname text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_nickname is null or p_nickname !~ '^[A-Za-z0-9_가-힣]{2,24}$' then
  raise exception 'NICKNAME_INVALID';
 end if;
 return not exists (
  select 1 from public.profiles
  where lower(nickname)=lower(p_nickname) and id<>actor
 );
end;
$$;

create function public.set_my_nickname(p_nickname text)
returns text language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_nickname is null or p_nickname !~ '^[A-Za-z0-9_가-힣]{2,24}$' then
  raise exception 'NICKNAME_INVALID';
 end if;
 update public.profiles set nickname=p_nickname where id=actor;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 return p_nickname;
exception when unique_violation then
 raise exception 'NICKNAME_TAKEN' using errcode='23505';
end;
$$;

revoke all on function public.check_nickname_available(text) from public,anon;
revoke all on function public.set_my_nickname(text) from public,anon;
grant execute on function public.check_nickname_available(text),
 public.set_my_nickname(text) to authenticated;

-- profiles table remains SELECT-self only via RLS; no client UPDATE grant.
commit;