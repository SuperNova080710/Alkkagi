begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  rating integer not null default 1000 check (rating >= 0),
  ranked_wins integer not null default 0 check (ranked_wins >= 0),
  ranked_losses integer not null default 0 check (ranked_losses >= 0),
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6,8}$'),
  owner_id uuid not null references public.profiles(id),
  mode text not null default 'casual' check (mode = 'casual'),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'closed')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  seat smallint not null check (seat in (1, 2)),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid unique references public.rooms(id),
  mode text not null default 'casual' check (mode = 'casual'),
  player1_id uuid not null references public.profiles(id),
  player2_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  turn_user_id uuid not null references public.profiles(id),
  turn_no integer not null default 1 check (turn_no >= 1),
  board_state jsonb not null check (jsonb_typeof(board_state) = 'object'),
  winner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (player1_id <> player2_id),
  check (turn_user_id in (player1_id, player2_id)),
  check (winner_id is null or winner_id in (player1_id, player2_id)),
  check (status = 'finished' or winner_id is null),
  check ((status = 'active' and finished_at is null) or (status <> 'active' and finished_at is not null))
);

create table public.shots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id),
  turn_no integer not null check (turn_no >= 1),
  request_id uuid not null,
  player_id uuid not null references public.profiles(id),
  piece_id text not null check (char_length(piece_id) between 1 and 64),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  result_state jsonb not null check (jsonb_typeof(result_state) = 'object'),
  created_at timestamptz not null default now(),
  unique (match_id, turn_no),
  unique (match_id, request_id)
);

create index room_players_user_idx on public.room_players(user_id);
create index rooms_owner_idx on public.rooms(owner_id);
create index matches_player1_idx on public.matches(player1_id);
create index matches_player2_idx on public.matches(player2_id);

-- Ignore client-supplied role/rating/nickname metadata at account creation.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, 'player_' || left(replace(new.id::text, '-', ''), 12));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill accounts that were created before this migration.
insert into public.profiles(id, nickname)
select id, 'player_' || left(replace(id::text, '-', ''), 12) from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.matches enable row level security;
alter table public.shots enable row level security;

-- Explicit grants also override Supabase's existing default table privileges.
revoke all on public.profiles, public.rooms, public.room_players, public.matches, public.shots from public, anon, authenticated;
grant select on public.profiles, public.rooms, public.room_players, public.matches, public.shots to authenticated;
grant all on public.profiles, public.rooms, public.room_players, public.matches, public.shots to service_role;

create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy room_players_read_self on public.room_players for select to authenticated
using (user_id = (select auth.uid()));
create policy rooms_read_member on public.rooms for select to authenticated
using (exists (
  select 1 from public.room_players rp
  where rp.room_id = rooms.id and rp.user_id = (select auth.uid())
));
create policy matches_read_participant on public.matches for select to authenticated
using ((select auth.uid()) in (player1_id, player2_id));
create policy shots_read_participant on public.shots for select to authenticated
using (exists (
  select 1 from public.matches m
  where m.id = shots.match_id and (select auth.uid()) in (m.player1_id, m.player2_id)
));

-- No client write policies. Mutations require a separately authorized server path.
-- Ranked mode, public leaderboard and atomic room/turn RPCs belong to later issues.
commit;
