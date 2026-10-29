begin;

-- Friends V1 (#72-#73): explicit pairs and blocks; neither owns RP or game data.
create table public.friend_links (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create unique index friend_links_pair_unique on public.friend_links
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index friend_links_requested_idx on public.friend_links (requester_id, status, created_at desc);
create index friend_links_received_idx on public.friend_links (recipient_id, status, created_at desc);

create table public.player_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index player_blocks_blocked_idx on public.player_blocks (blocked_id);
alter table public.friend_links enable row level security;
alter table public.player_blocks enable row level security;
revoke all on public.friend_links, public.player_blocks from public, anon, authenticated;
grant select on public.friend_links, public.player_blocks to authenticated;
grant all on public.friend_links, public.player_blocks to service_role;
create policy friend_links_read_self on public.friend_links for select to authenticated
  using (requester_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy player_blocks_read_self on public.player_blocks for select to authenticated
  using (blocker_id=(select auth.uid()));
-- No client INSERT/UPDATE/DELETE grants or policies on either table.

create function public.send_friend_request(p_target uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := auth.uid();
  existing public.friend_links%rowtype;
  target_visible boolean;
  new_request uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_target is null or p_target=actor then raise exception 'INVALID_FRIEND_TARGET'; end if;
  -- Lock both participants in a deterministic order to serialize the entire pair.
  perform 1 from public.profiles where id in (actor,p_target) order by id for update;
  if not exists(select 1 from public.profiles where id=p_target) then
    raise exception 'FRIEND_NOT_AVAILABLE';
  end if;
  select coalesce(s.discoverable,true) into target_visible
    from public.profiles p
    left join public.player_profile_settings s on s.user_id=p.id
    where p.id=p_target;
  if not target_visible or exists (
    select 1 from public.player_blocks b
    where (b.blocker_id=actor and b.blocked_id=p_target)
       or (b.blocker_id=p_target and b.blocked_id=actor)
  ) then raise exception 'FRIEND_NOT_AVAILABLE'; end if;

  select * into existing from public.friend_links f
    where (f.requester_id=actor and f.recipient_id=p_target)
       or (f.requester_id=p_target and f.recipient_id=actor)
    for update;
  if found then
    if existing.status='accepted' then raise exception 'ALREADY_FRIENDS'; end if;
    if existing.status='pending' then
      if existing.requester_id=actor then
        return jsonb_build_object('requestId',existing.id,'status','pending','alreadyPending',true);
      end if;
      raise exception 'INCOMING_FRIEND_REQUEST';
    end if;
    if existing.updated_at > clock_timestamp()-interval '24 hours' then
      raise exception 'FRIEND_REQUEST_COOLDOWN';
    end if;
  end if;

  if (select count(*) from public.friend_links
     where requester_id=actor and status='pending') >= 20 then
    raise exception 'FRIEND_REQUEST_LIMIT';
  end if;
  if (select count(*) from public.friend_links
     where recipient_id=p_target and status='pending') >= 40 then
    raise exception 'FRIEND_INBOX_FULL';
  end if;
  if (select count(*) from public.friend_links
     where status='accepted' and actor in (requester_id,recipient_id)) >= 100 then
    raise exception 'FRIENDS_FULL';
  end if;

  if existing.id is null then
    insert into public.friend_links(requester_id,recipient_id)
      values(actor,p_target) returning id into new_request;
  else
    update public.friend_links set requester_id=actor,recipient_id=p_target,
      status='pending',created_at=now(),updated_at=now()
    where id=existing.id returning id into new_request;
  end if;
  return jsonb_build_object('requestId',new_request,'status','pending','alreadyPending',false);
end;
$$;

create function public.respond_friend_request(p_request_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); link public.friend_links%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null or p_accept is null then raise exception 'INVALID_FRIEND_REQUEST'; end if;
  select * into link from public.friend_links where id=p_request_id;
  if not found or link.recipient_id<>actor or link.status<>'pending' then
    raise exception 'FRIEND_REQUEST_NOT_FOUND';
  end if;
  perform 1 from public.profiles
    where id in (link.requester_id,link.recipient_id) order by id for update;
  select * into link from public.friend_links where id=p_request_id for update;
  if not found or link.recipient_id<>actor or link.status<>'pending' then
    raise exception 'FRIEND_REQUEST_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.player_blocks b
    where (b.blocker_id=actor and b.blocked_id=link.requester_id)
       or (b.blocker_id=link.requester_id and b.blocked_id=actor)
  ) then raise exception 'FRIEND_REQUEST_NOT_FOUND'; end if;
  if p_accept then
    if (select count(*) from public.friend_links f
        where f.status='accepted' and actor in (f.requester_id,f.recipient_id)) >= 100
       or (select count(*) from public.friend_links f
        where f.status='accepted' and link.requester_id in (f.requester_id,f.recipient_id)) >= 100
    then raise exception 'FRIENDS_FULL'; end if;
  end if;
  update public.friend_links set
    status=case when p_accept then 'accepted' else 'rejected' end,
    updated_at=now() where id=link.id;
  return jsonb_build_object('requestId',link.id,'status',case when p_accept then 'accepted' else 'rejected' end);
end;
$$;

create function public.remove_friend(p_target uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_target is null or p_target=actor then raise exception 'INVALID_FRIEND_TARGET'; end if;
  perform 1 from public.profiles where id in(actor,p_target) order by id for update;
  delete from public.friend_links where status='accepted' and
    ((requester_id=actor and recipient_id=p_target)
      or (requester_id=p_target and recipient_id=actor));
  return found;
end;
$$;

create function public.set_player_block(p_target uuid,p_block boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_target is null or p_target=actor or p_block is null then
    raise exception 'INVALID_BLOCK_TARGET';
  end if;
  perform 1 from public.profiles where id in(actor,p_target) order by id for update;
  if not exists(select 1 from public.profiles where id=p_target) then
    raise exception 'FRIEND_NOT_AVAILABLE';
  end if;
  if p_block then
    if not exists(select 1 from public.player_blocks
        where blocker_id=actor and blocked_id=p_target)
       and (select count(*) from public.player_blocks
        where blocker_id=actor) >= 100 then
      raise exception 'BLOCK_LIMIT';
    end if;
    insert into public.player_blocks(blocker_id,blocked_id) values(actor,p_target)
      on conflict do nothing;
    delete from public.friend_links where
      (requester_id=actor and recipient_id=p_target)
      or (requester_id=p_target and recipient_id=actor);
  else
    delete from public.player_blocks where blocker_id=actor and blocked_id=p_target;
  end if;
  return jsonb_build_object('userId',p_target,'blocked',p_block);
end;
$$;

create function public.get_friend_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  friends_json jsonb;
  incoming_json jsonb;
  outgoing_json jsonb;
  blocked_json jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.nickname,f.id),'[]'::jsonb)
    into friends_json from (
      select p.id,p.nickname from public.friend_links l
      join public.profiles p on p.id=case when l.requester_id=actor
        then l.recipient_id else l.requester_id end
      where l.status='accepted' and actor in(l.requester_id,l.recipient_id)
      order by p.nickname,p.id limit 100
    ) f;
  select coalesce(jsonb_agg(to_jsonb(i) order by i."createdAt" desc,i.id),'[]'::jsonb)
    into incoming_json from (
      select l.id,l.requester_id as "userId",p.nickname,l.created_at as "createdAt"
      from public.friend_links l join public.profiles p on p.id=l.requester_id
      where l.status='pending' and l.recipient_id=actor
      order by l.created_at desc,l.id limit 40
    ) i;
  select coalesce(jsonb_agg(to_jsonb(o) order by o."createdAt" desc,o.id),'[]'::jsonb)
    into outgoing_json from (
      select l.id,l.recipient_id as "userId",p.nickname,l.created_at as "createdAt"
      from public.friend_links l join public.profiles p on p.id=l.recipient_id
      where l.status='pending' and l.requester_id=actor
      order by l.created_at desc,l.id limit 20
    ) o;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.nickname,b.id),'[]'::jsonb)
    into blocked_json from (
      select p.id,p.nickname from public.player_blocks pb
      join public.profiles p on p.id=pb.blocked_id
      where pb.blocker_id=actor order by p.nickname,p.id limit 100
    ) b;
  return jsonb_build_object('friends',friends_json,'incoming',incoming_json,
    'outgoing',outgoing_json,'blocked',blocked_json);
end;
$$;

revoke all on function public.send_friend_request(uuid),
  public.respond_friend_request(uuid,boolean),
  public.remove_friend(uuid),
  public.set_player_block(uuid,boolean),
  public.get_friend_overview() from public,anon,authenticated;
grant execute on function public.send_friend_request(uuid),
  public.respond_friend_request(uuid,boolean),
  public.remove_friend(uuid),
  public.set_player_block(uuid,boolean),
  public.get_friend_overview() to authenticated;
commit;
