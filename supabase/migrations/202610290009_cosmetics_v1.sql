begin;

-- Cosmetics V1 (#111/#112). Data-only; never affects piece physics, Elo or ratings.
-- Optional XP V1 (#110, migration 008): XP-gated items stay locked until applied.
create table public.cosmetic_items (
  code text primary key check(code ~ '^(piece|avatar)-[a-z0-9-]{2,32}$'),
  slot text not null check(slot in ('piece','avatar')),
  name text not null check(char_length(name) between 1 and 48),
  description text not null default '',
  unlock_kind text not null check(unlock_kind in ('starter','ranked_wins','xp_level')),
  required_value integer not null check(required_value between 0 and 1000000),
  published boolean not null default false,
  unique(code,slot),
  check ((unlock_kind='starter' and required_value=0)
    or (unlock_kind<>'starter' and required_value>0))
);

insert into public.cosmetic_items(code,slot,name,description,unlock_kind,required_value,published)
values
 ('piece-classic','piece','기본 알','첫 로그인부터 사용할 수 있는 알','starter',0,true),
 ('piece-forest','piece','숲빛 알','랭크 1승 달성 후 해금','ranked_wins',1,true),
 ('piece-starlight','piece','별빛 알','레벨 3 달성 후 해금','xp_level',3,true),
 ('avatar-classic','avatar','기본 캐릭터','처음부터 사용할 수 있는 캐릭터','starter',0,true),
 ('avatar-bronze','avatar','청동 캐릭터','랭크 3승 달성 후 해금','ranked_wins',3,true),
 ('avatar-orbit','avatar','궤도 캐릭터','레벨 2 달성 후 해금','xp_level',2,true);

create table public.player_cosmetic_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_code text not null references public.cosmetic_items(code) on delete restrict,
  unlocked_at timestamptz not null default now(),
  primary key(user_id,item_code)
);
create index player_cosmetic_inventory_recent_idx
  on public.player_cosmetic_inventory(user_id,unlocked_at desc);

-- Composite FKs enforce both slot and ownership even for privileged writes.
create table public.player_cosmetic_loadouts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  piece_code text not null default 'piece-classic',
  piece_slot text not null default 'piece' check(piece_slot='piece'),
  avatar_code text not null default 'avatar-classic',
  avatar_slot text not null default 'avatar' check(avatar_slot='avatar'),
  updated_at timestamptz not null default now(),
  foreign key (piece_code,piece_slot) references public.cosmetic_items(code,slot),
  foreign key (avatar_code,avatar_slot) references public.cosmetic_items(code,slot),
  foreign key (user_id,piece_code) references public.player_cosmetic_inventory(user_id,item_code),
  foreign key (user_id,avatar_code) references public.player_cosmetic_inventory(user_id,item_code)
);

alter table public.cosmetic_items enable row level security;
alter table public.player_cosmetic_inventory enable row level security;
alter table public.player_cosmetic_loadouts enable row level security;
revoke all on public.cosmetic_items,public.player_cosmetic_inventory,
  public.player_cosmetic_loadouts from public,anon,authenticated;
grant select on public.cosmetic_items,public.player_cosmetic_inventory,
  public.player_cosmetic_loadouts to authenticated;
grant all on public.cosmetic_items,public.player_cosmetic_inventory,
  public.player_cosmetic_loadouts to service_role;
create policy cosmetics_published_read on public.cosmetic_items
  for select to authenticated using (published);
create policy cosmetics_inventory_self on public.player_cosmetic_inventory
  for select to authenticated using(user_id=(select auth.uid()));
create policy cosmetics_loadout_self on public.player_cosmetic_loadouts
  for select to authenticated using(user_id=(select auth.uid()));
-- No client write policy or grant for any of these tables.

create function private.cosmetic_xp_level(p_user_id uuid)
returns integer language plpgsql stable security definer set search_path=''
as $$
declare xp bigint := 0;
begin
  -- This SQL must work before the separate XP V1 migration has been merged.
  -- Fixed SQL string with bound identifier; not derived from client input.
  if to_regclass('public.player_progress') is not null then
    execute 'select coalesce((select total_xp from public.player_progress where user_id=$1),0)'
      into xp using p_user_id;
  end if;
  return floor(sqrt(xp::numeric/100))::integer+1;
end;
$$;
revoke all on function private.cosmetic_xp_level(uuid)
  from public,anon,authenticated,service_role;

create function private.sync_player_cosmetics(p_actor uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare wins integer; current_level integer;
begin
  -- Caller MUST hold the profile row lock; ensures two sessions cannot
  -- perform conflicting unlock/equip writes for the same user.
  select ranked_wins into wins from public.profiles where id=p_actor;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  current_level:=private.cosmetic_xp_level(p_actor);
  insert into public.player_cosmetic_inventory(user_id,item_code)
  select p_actor,i.code from public.cosmetic_items i
    where i.published and (
      i.unlock_kind='starter'
      or (i.unlock_kind='ranked_wins' and wins>=i.required_value)
      or (i.unlock_kind='xp_level' and current_level>=i.required_value)
    )
  on conflict(user_id,item_code) do nothing;
  insert into public.player_cosmetic_loadouts(user_id)
    values(p_actor) on conflict(user_id) do nothing;
end;
$$;
revoke all on function private.sync_player_cosmetics(uuid)
  from public,anon,authenticated,service_role;

-- A previously equipped item may be unpublished without changing the stored
-- loadout. Never disclose unpublished item codes through public RPC responses.
-- If the item is republished, the user's prior selection becomes visible again.
create function private.visible_cosmetic_code(p_code text,p_fallback text)
returns text language sql stable security definer set search_path=''
as $visible_cosmetic$
  select case when exists(
    select 1 from public.cosmetic_items where code=p_code and published
  ) then p_code else p_fallback end;
$visible_cosmetic$;
revoke all on function private.visible_cosmetic_code(text,text)
  from public,anon,authenticated,service_role;

create function public.get_my_cosmetics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); equipped public.player_cosmetic_loadouts%rowtype;
  catalog jsonb; wins integer; current_level integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  perform private.sync_player_cosmetics(actor);
  select * into equipped from public.player_cosmetic_loadouts where user_id=actor;
  equipped.piece_code:=private.visible_cosmetic_code(equipped.piece_code,'piece-classic');
  equipped.avatar_code:=private.visible_cosmetic_code(equipped.avatar_code,'avatar-classic');
  select ranked_wins into wins from public.profiles where id=actor;
  current_level:=private.cosmetic_xp_level(actor);

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',i.code,'slot',i.slot,'name',i.name,'description',i.description,
    'unlockKind',i.unlock_kind,'requiredValue',i.required_value,
    'owned',(inv.user_id is not null),
    'equipped',(i.code=equipped.piece_code or i.code=equipped.avatar_code),
    'unlockedAt',inv.unlocked_at)
    order by i.slot,i.code),'[]'::jsonb) into catalog
  from public.cosmetic_items i
  left join public.player_cosmetic_inventory inv on inv.user_id=actor and inv.item_code=i.code
  where i.published;
  return jsonb_build_object(
    'loadout',jsonb_build_object('pieceCode',equipped.piece_code,'avatarCode',equipped.avatar_code),
    'items',catalog,'rankedWins',wins,'level',current_level);
end;
$$;

create function public.equip_my_cosmetic(p_item_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); slot_name text; equipped public.player_cosmetic_loadouts%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_item_code is null or char_length(p_item_code)>40
    or p_item_code !~ '^(piece|avatar)-[a-z0-9-]{2,32}$' then
    raise exception 'INVALID_COSMETIC_ITEM';
  end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  perform private.sync_player_cosmetics(actor);
  select slot into slot_name from public.cosmetic_items
    where code=p_item_code and published;
  if not found then raise exception 'COSMETIC_NOT_AVAILABLE'; end if;
  if not exists(select 1 from public.player_cosmetic_inventory
    where user_id=actor and item_code=p_item_code) then
    raise exception 'COSMETIC_LOCKED';
  end if;
  if slot_name='piece' then
    update public.player_cosmetic_loadouts
    set piece_code=p_item_code,updated_at=now()
    where user_id=actor and piece_code<>p_item_code;
  else
    update public.player_cosmetic_loadouts
    set avatar_code=p_item_code,updated_at=now()
    where user_id=actor and avatar_code<>p_item_code;
  end if;
  select * into equipped from public.player_cosmetic_loadouts where user_id=actor;
  equipped.piece_code:=private.visible_cosmetic_code(equipped.piece_code,'piece-classic');
  equipped.avatar_code:=private.visible_cosmetic_code(equipped.avatar_code,'avatar-classic');
  return jsonb_build_object('pieceCode',equipped.piece_code,'avatarCode',equipped.avatar_code);
end;
$$;

create function public.get_public_player_cosmetics(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); equipped public.player_cosmetic_loadouts%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_player_id is null then raise exception 'INVALID_PLAYER_ID'; end if;
  if not exists(select 1 from public.profiles where id=p_player_id) then return null; end if;
  if actor<>p_player_id and exists(
    select 1 from public.player_profile_settings s
      where s.user_id=p_player_id and s.discoverable=false
  ) then return null; end if;
  select * into equipped from public.player_cosmetic_loadouts where user_id=p_player_id;
  return jsonb_build_object('userId',p_player_id,
    'pieceCode',private.visible_cosmetic_code(equipped.piece_code,'piece-classic'),
    'avatarCode',private.visible_cosmetic_code(equipped.avatar_code,'avatar-classic'));
end;
$$;

revoke all on function public.get_my_cosmetics(),
  public.equip_my_cosmetic(text),public.get_public_player_cosmetics(uuid)
  from public,anon,authenticated;
grant execute on function public.get_my_cosmetics(),
  public.equip_my_cosmetic(text),public.get_public_player_cosmetics(uuid) to authenticated;

commit;
