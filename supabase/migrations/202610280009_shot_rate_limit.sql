begin;
-- Server-exclusive, PostgreSQL-backed flood protection for shot requests.
create table public.shot_rate_limits (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_attempt timestamptz not null default now()
);
alter table public.shot_rate_limits enable row level security;
revoke all on public.shot_rate_limits from public,anon,authenticated;
grant all on public.shot_rate_limits to service_role;
create function public.claim_shot_slot(p_user uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if p_user is null then raise exception 'INVALID_USER'; end if;
 insert into public.shot_rate_limits(user_id,last_attempt) values(p_user,now())
 on conflict(user_id) do update set last_attempt=excluded.last_attempt
 where public.shot_rate_limits.last_attempt<now()-interval '350 milliseconds';
 return found;
end;
$$;
revoke all on function public.claim_shot_slot(uuid) from public,anon,authenticated;
grant execute on function public.claim_shot_slot(uuid) to service_role;
commit;