begin;

alter table public.cosmetic_items
  drop constraint cosmetic_items_code_check,
  drop constraint cosmetic_items_slot_check,
  add constraint cosmetic_items_code_check check(code ~ '^(piece|avatar|omok|chess)-[a-z0-9-]{2,32}$'),
  add constraint cosmetic_items_slot_check check(slot in('piece','avatar','omok','chess')),
  add constraint cosmetic_items_game_slot_check
    check(slot not in('omok','chess') or split_part(code,'-',1)=slot);

insert into public.cosmetic_items(code,slot,name,description,unlock_kind,required_value,published)
values
  ('omok-classic','omok','기본 오목돌','기본 흑돌과 백돌','starter',0,true),
  ('omok-jade','omok','비취 오목돌','짙은 비취빛 흑돌과 밝은 옥빛 백돌','xp_level',2,true),
  ('chess-classic','chess','기본 체스 기물','기본 백·흑 기물 세트','starter',0,true),
  ('chess-sapphire','chess','사파이어 체스 기물','맑은 하늘빛 백 기물과 짙은 남색 흑 기물','xp_level',2,true);

-- Null means the starter appearance, including on loadouts created before this migration.
-- Explicit selections still require an owned item in the correct slot.
alter table public.player_cosmetic_loadouts
  add column omok_code text,
  add column omok_slot text not null default 'omok' check(omok_slot='omok'),
  add column chess_code text,
  add column chess_slot text not null default 'chess' check(chess_slot='chess'),
  add foreign key(omok_code,omok_slot) references public.cosmetic_items(code,slot),
  add foreign key(chess_code,chess_slot) references public.cosmetic_items(code,slot),
  add foreign key(user_id,omok_code) references public.player_cosmetic_inventory(user_id,item_code),
  add foreign key(user_id,chess_code) references public.player_cosmetic_inventory(user_id,item_code);

create function private.cosmetic_loadout_payload(equipped public.player_cosmetic_loadouts)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'pieceCode',private.visible_cosmetic_code((equipped).piece_code,'piece-classic'),
    'avatarCode',private.visible_cosmetic_code((equipped).avatar_code,'avatar-classic'),
    'omokCode',private.visible_cosmetic_code((equipped).omok_code,'omok-classic'),
    'chessCode',private.visible_cosmetic_code((equipped).chess_code,'chess-classic')
  );
$$;
revoke all on function private.cosmetic_loadout_payload(public.player_cosmetic_loadouts)
  from public,anon,authenticated,service_role;

create or replace function public.get_my_cosmetics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); equipped public.player_cosmetic_loadouts%rowtype;
  catalog jsonb; visible jsonb; wins integer; current_level integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  perform private.sync_player_cosmetics(actor);
  select * into equipped from public.player_cosmetic_loadouts where user_id=actor;
  visible:=private.cosmetic_loadout_payload(equipped);
  select ranked_wins into wins from public.profiles where id=actor;
  current_level:=private.cosmetic_xp_level(actor);

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',i.code,'slot',i.slot,'name',i.name,'description',i.description,
    'unlockKind',i.unlock_kind,'requiredValue',i.required_value,
    'owned',(inv.user_id is not null),
    'equipped',(i.code=any(array[visible->>'pieceCode',visible->>'avatarCode',visible->>'omokCode',visible->>'chessCode'])),
    'unlockedAt',inv.unlocked_at)
    order by i.slot,i.code),'[]'::jsonb) into catalog
  from public.cosmetic_items i
  left join public.player_cosmetic_inventory inv on inv.user_id=actor and inv.item_code=i.code
  where i.published;
  return jsonb_build_object(
    'loadout',visible,
    'items',catalog,'rankedWins',wins,'level',current_level);
end;
$$;

create or replace function public.equip_my_cosmetic(p_item_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); slot_name text; equipped public.player_cosmetic_loadouts%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_item_code is null or char_length(p_item_code)>40
    or p_item_code !~ '^(piece|avatar|omok|chess)-[a-z0-9-]{2,32}$' then
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
  elsif slot_name='avatar' then
    update public.player_cosmetic_loadouts
    set avatar_code=p_item_code,updated_at=now()
    where user_id=actor and avatar_code<>p_item_code;
  elsif slot_name='omok' then
    update public.player_cosmetic_loadouts
    set omok_code=p_item_code,updated_at=now()
    where user_id=actor and omok_code is distinct from p_item_code;
  elsif slot_name='chess' then
    update public.player_cosmetic_loadouts
    set chess_code=p_item_code,updated_at=now()
    where user_id=actor and chess_code is distinct from p_item_code;
  end if;
  select * into equipped from public.player_cosmetic_loadouts where user_id=actor;
  return private.cosmetic_loadout_payload(equipped);
end;
$$;

create or replace function public.get_public_player_cosmetics(p_player_id uuid)
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
  return jsonb_build_object('userId',p_player_id) || private.cosmetic_loadout_payload(equipped);
end;
$$;

commit;
