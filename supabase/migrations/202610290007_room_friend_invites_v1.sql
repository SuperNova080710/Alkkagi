begin;

-- Room invite V1 (#82/#83). Independent of DM V1; requires Friends V1 (005).
-- Invites are private application state, never directly readable/writable by clients.
create table public.room_friend_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  responded_at timestamptz,
  unique(room_id, invitee_id),
  check(inviter_id <> invitee_id),
  check(expires_at > created_at),
  check((status='pending' and responded_at is null)
    or (status in ('accepted','declined') and responded_at is not null))
);
create index room_friend_invites_recipient_idx
  on public.room_friend_invites(invitee_id,created_at desc);
create index room_friend_invites_inviter_idx
  on public.room_friend_invites(inviter_id,created_at desc);
alter table public.room_friend_invites enable row level security;
revoke all on public.room_friend_invites from public,anon,authenticated;
grant all on public.room_friend_invites to service_role;
-- Deliberately no authenticated SELECT/WRITE policies; only guarded RPCs.

create function public.send_room_friend_invite(p_room_id uuid,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  initial_host uuid;
  locked_room public.rooms%rowtype;
  existing public.room_friend_invites%rowtype;
  invite_id uuid;
  checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room_id is null or p_target_id is null or actor=p_target_id then
    raise exception 'INVALID_ROOM_INVITE'; end if;

  -- Profile locks agree with Friends V1 block/unfriend lock ordering.
  select owner_id into initial_host from public.rooms where id=p_room_id;
  if initial_host is distinct from actor then raise exception 'ROOM_NOT_AVAILABLE'; end if;
  perform 1 from public.profiles where id in (actor,p_target_id) order by id for update;
  select * into locked_room from public.rooms where id=p_room_id for update;
  checked_at:=clock_timestamp();
  if not found or locked_room.owner_id<>actor
    or locked_room.status<>'waiting' or locked_room.expires_at<=checked_at
    or exists(select 1 from public.room_players rp
      where rp.room_id=p_room_id and rp.seat=2)
    or not exists(select 1 from public.room_players rp
      where rp.room_id=p_room_id and rp.seat=1 and rp.user_id=actor)
    or exists(select 1 from public.matches m where m.room_id=p_room_id)
    or exists(select 1 from public.ai_matches am where am.room_id=p_room_id)
  then raise exception 'ROOM_NOT_AVAILABLE'; end if;

  if not exists(select 1 from public.friend_links f
    where f.status='accepted' and (
      (f.requester_id=actor and f.recipient_id=p_target_id) or
      (f.requester_id=p_target_id and f.recipient_id=actor)
    ))
    or exists(select 1 from public.player_blocks b where
      (b.blocker_id=actor and b.blocked_id=p_target_id) or
      (b.blocker_id=p_target_id and b.blocked_id=actor))
  then raise exception 'FRIEND_NOT_AVAILABLE'; end if;

  select * into existing from public.room_friend_invites i
    where i.room_id=p_room_id and i.invitee_id=p_target_id for update;
  if found then
    if existing.status='pending' and existing.expires_at>checked_at then
      return jsonb_build_object('inviteId',existing.id,'status','pending',
        'expiresAt',existing.expires_at,'alreadyPending',true);
    end if;
    -- A declined or timed-out invitation cannot be reset by the host:
    -- preserves consent and prevents repeated same-room notifications.
    raise exception 'ROOM_INVITE_ALREADY_SENT';
  end if;

  if (select count(*) from public.room_friend_invites i
      where i.inviter_id=actor and i.created_at>checked_at-interval '10 minutes')>=20
    or (select count(*) from public.room_friend_invites i
      where i.inviter_id=actor and i.status='pending' and i.expires_at>checked_at)>=10
  then raise exception 'ROOM_INVITE_RATE_LIMIT'; end if;
  if (select count(*) from public.room_friend_invites i
      where i.invitee_id=p_target_id and i.status='pending' and i.expires_at>checked_at)>=20
  then raise exception 'ROOM_INVITE_INBOX_FULL'; end if;

  insert into public.room_friend_invites(room_id,inviter_id,invitee_id)
    values(p_room_id,actor,p_target_id) returning id into invite_id;
  return jsonb_build_object('inviteId',invite_id,'status','pending',
    'expiresAt',(select expires_at from public.room_friend_invites where id=invite_id),
    'alreadyPending',false);
end;
$$;

-- Listing has no direct grants, room codes, emails, or private profile fields.
-- Invitations disappear from the inbox when the room fills or friendship ends.
create function public.list_received_room_invites()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();output jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v."createdAt" desc,v.id),'[]'::jsonb)
  into output from (
    select i.id,i.room_id as "roomId",i.inviter_id as "inviterId",
      p.nickname as "inviterNickname",i.created_at as "createdAt",
      i.expires_at as "expiresAt"
    from public.room_friend_invites i
    join public.rooms r on r.id=i.room_id
    join public.profiles p on p.id=i.inviter_id
    where i.invitee_id=actor and i.status='pending'
      and i.expires_at>now() and r.expires_at>now() and r.status='waiting'
      and r.owner_id=i.inviter_id
      and not exists(select 1 from public.room_players rp where rp.room_id=r.id and rp.seat=2)
      and exists(select 1 from public.room_players rp
        where rp.room_id=r.id and rp.seat=1 and rp.user_id=i.inviter_id)
      and not exists(select 1 from public.ai_matches am where am.room_id=r.id)
      and exists(select 1 from public.friend_links f where f.status='accepted'
        and ((f.requester_id=actor and f.recipient_id=i.inviter_id)
          or (f.requester_id=i.inviter_id and f.recipient_id=actor)))
      and not exists(select 1 from public.player_blocks b
        where (b.blocker_id=actor and b.blocked_id=i.inviter_id)
           or (b.blocker_id=i.inviter_id and b.blocked_id=actor))
    order by i.created_at desc,i.id limit 20
  ) v;
  return output;
end;
$$;

create function public.list_sent_room_invites(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();output jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room_id is null or not exists(select 1 from public.rooms r
    where r.id=p_room_id and r.owner_id=actor) then
    raise exception 'ROOM_NOT_AVAILABLE';
  end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v."createdAt" desc,v.id),'[]'::jsonb)
  into output from (
    select i.id,i.invitee_id as "inviteeId",
      case when exists(select 1 from public.friend_links f
        where f.status='accepted' and ((f.requester_id=actor and f.recipient_id=i.invitee_id)
          or (f.requester_id=i.invitee_id and f.recipient_id=actor)))
        and not exists(select 1 from public.player_blocks b
          where (b.blocker_id=actor and b.blocked_id=i.invitee_id)
             or (b.blocker_id=i.invitee_id and b.blocked_id=actor))
        then p.nickname else null end as "inviteeNickname",
      case when i.status='pending' and i.expires_at<=now()
        then 'expired' else i.status end as status,
      i.created_at as "createdAt",i.expires_at as "expiresAt"
    from public.room_friend_invites i
      join public.profiles p on p.id=i.invitee_id
    where i.room_id=p_room_id and i.inviter_id=actor
    order by i.created_at desc,i.id limit 50
  ) v;
  return output;
end;
$$;

create function public.respond_room_friend_invite(p_invite_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  original public.room_friend_invites%rowtype;
  locked_invite public.room_friend_invites%rowtype;
  locked_room public.rooms%rowtype;
  checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_invite_id is null or p_accept is null then raise exception 'INVALID_ROOM_INVITE'; end if;

  -- Snapshot only locates lock targets; all security checks are repeated after
  -- acquiring locks in the same order as friend block/unfriend and invite send.
  select * into original from public.room_friend_invites where id=p_invite_id;
  if not found or original.invitee_id<>actor then
    raise exception 'ROOM_INVITE_NOT_FOUND'; end if;
  perform 1 from public.profiles
    where id in (original.inviter_id,actor) order by id for update;
  select * into locked_room from public.rooms where id=original.room_id for update;
  select * into locked_invite from public.room_friend_invites
    where id=p_invite_id for update;
  checked_at:=clock_timestamp();
  if not found or locked_invite.invitee_id<>actor
    or locked_invite.room_id<>original.room_id
    or locked_invite.inviter_id<>original.inviter_id
    or locked_invite.status<>'pending'
    or locked_invite.expires_at<=checked_at
    or locked_room.id is null or locked_room.owner_id<>locked_invite.inviter_id
    or locked_room.status<>'waiting' or locked_room.expires_at<=checked_at
    or not exists(select 1 from public.friend_links f where f.status='accepted'
      and ((f.requester_id=actor and f.recipient_id=locked_invite.inviter_id)
        or (f.requester_id=locked_invite.inviter_id and f.recipient_id=actor)))
    or exists(select 1 from public.player_blocks b
      where (b.blocker_id=actor and b.blocked_id=locked_invite.inviter_id)
         or (b.blocker_id=locked_invite.inviter_id and b.blocked_id=actor))
  then raise exception 'ROOM_INVITE_NOT_FOUND'; end if;

  if p_accept then
    if not exists(select 1 from public.room_players rp
      where rp.room_id=locked_room.id and rp.user_id=locked_room.owner_id and rp.seat=1)
      or exists(select 1 from public.room_players rp
        where rp.room_id=locked_room.id and rp.seat=2)
      or exists(select 1 from public.matches m where m.room_id=locked_room.id)
      or exists(select 1 from public.ai_matches am where am.room_id=locked_room.id)
    then raise exception 'ROOM_NOT_AVAILABLE'; end if;

    insert into public.room_players(room_id,user_id,seat)
      values(locked_room.id,actor,2);
  end if;
  update public.room_friend_invites
    set status=case when p_accept then 'accepted' else 'declined' end,
      responded_at=checked_at
    where id=locked_invite.id;
  return jsonb_build_object('inviteId',locked_invite.id,
    'status',case when p_accept then 'accepted' else 'declined' end,
    'roomId',case when p_accept then locked_room.id else null end);
end;
$$;

revoke all on function public.send_room_friend_invite(uuid,uuid),
  public.list_received_room_invites(),
  public.list_sent_room_invites(uuid),
  public.respond_room_friend_invite(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.send_room_friend_invite(uuid,uuid),
  public.list_received_room_invites(),
  public.list_sent_room_invites(uuid),
  public.respond_room_friend_invite(uuid,boolean) to authenticated;
commit;
