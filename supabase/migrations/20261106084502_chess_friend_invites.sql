begin;

-- Chess friend invitations use the same expiry and consent rules as Alkkagi.
-- Invites are private application state, never directly readable/writable by clients.
create table public.chess_friend_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chess_rooms(id) on delete cascade,
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
create index chess_friend_invites_recipient_idx
  on public.chess_friend_invites(invitee_id,created_at desc);
create index chess_friend_invites_inviter_idx
  on public.chess_friend_invites(inviter_id,created_at desc);
alter table public.chess_friend_invites enable row level security;
revoke all on public.chess_friend_invites from public,anon,authenticated;
grant select,insert,update on public.chess_friend_invites to service_role;
-- RPCs are invoked only by the server with the ID from its verified session.

create function public.chess_send_friend_invite(actor uuid,p_room_id uuid,p_target_id uuid)
returns jsonb language plpgsql set search_path=''
as $$
declare
  initial_host uuid;
  locked_room public.chess_rooms%rowtype;
  existing public.chess_friend_invites%rowtype;
  invite_id uuid;
  checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room_id is null or p_target_id is null or actor=p_target_id then
    raise exception 'INVALID_ROOM_INVITE'; end if;

  -- Match Friends V1's profile lock order without blocking the guest FK
  -- check in a concurrent code join that already holds the room lock.
  select host_id into initial_host from public.chess_rooms where id=p_room_id;
  if initial_host is distinct from actor then raise exception 'ROOM_NOT_AVAILABLE'; end if;
  perform 1 from public.profiles where id in (actor,p_target_id) order by id for no key update;
  select * into locked_room from public.chess_rooms where id=p_room_id for update;
  checked_at:=clock_timestamp();
  if not found or locked_room.host_id<>actor
    or locked_room.closed_at is not null or locked_room.expires_at<=checked_at
    or locked_room.guest_id is not null
    or exists(select 1 from public.chess_matches m where m.room_id=p_room_id)
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

  select * into existing from public.chess_friend_invites i
    where i.room_id=p_room_id and i.invitee_id=p_target_id for update;
  if found then
    if existing.status='pending' and existing.expires_at>checked_at
      and exists(select 1 from public.friend_links f
        where f.status='accepted' and f.updated_at<=existing.created_at
        and ((f.requester_id=actor and f.recipient_id=p_target_id)
          or (f.requester_id=p_target_id and f.recipient_id=actor))) then
      return jsonb_build_object('inviteId',existing.id,'status','pending',
        'expiresAt',existing.expires_at,'alreadyPending',true);
    end if;
    -- A declined or timed-out invitation cannot be reset by the host:
    -- preserves consent and prevents repeated same-room notifications.
    raise exception 'ROOM_INVITE_ALREADY_SENT';
  end if;

  if (select count(*) from public.chess_friend_invites i
      where i.inviter_id=actor and i.created_at>checked_at-interval '10 minutes')>=20
    or (select count(*) from public.chess_friend_invites i
      where i.inviter_id=actor and i.status='pending' and i.expires_at>checked_at)>=10
  then raise exception 'ROOM_INVITE_RATE_LIMIT'; end if;
  if (select count(*) from public.chess_friend_invites i
      where i.invitee_id=p_target_id and i.status='pending' and i.expires_at>checked_at)>=20
  then raise exception 'ROOM_INVITE_INBOX_FULL'; end if;

  insert into public.chess_friend_invites(room_id,inviter_id,invitee_id,created_at,expires_at)
    values(p_room_id,actor,p_target_id,checked_at,checked_at+interval '5 minutes')
    returning id into invite_id;
  return jsonb_build_object('inviteId',invite_id,'status','pending',
    'expiresAt',(select expires_at from public.chess_friend_invites where id=invite_id),
    'alreadyPending',false);
end;
$$;

-- Listing has no direct grants, room codes, emails, or private profile fields.
-- Invitations disappear from the inbox when the room fills or friendship ends.
create function public.chess_list_received_invites(actor uuid)
returns jsonb language plpgsql stable set search_path=''
as $$
declare output jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v."createdAt" desc,v.id),'[]'::jsonb)
  into output from (
    select i.id,i.room_id as "roomId",i.inviter_id as "inviterId",
      p.nickname as "inviterNickname",i.created_at as "createdAt",
      i.expires_at as "expiresAt"
    from public.chess_friend_invites i
    join public.chess_rooms r on r.id=i.room_id
    join public.profiles p on p.id=i.inviter_id
    where i.invitee_id=actor and i.status='pending'
      and i.expires_at>now() and r.expires_at>now() and r.closed_at is null
      and r.host_id=i.inviter_id and r.guest_id is null
      and not exists(select 1 from public.chess_matches m where m.room_id=r.id)
      and exists(select 1 from public.friend_links f
        where f.status='accepted' and f.updated_at<=i.created_at
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

create function public.chess_list_sent_invites(actor uuid,p_room_id uuid)
returns jsonb language plpgsql stable set search_path=''
as $$
declare output jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room_id is null or not exists(select 1 from public.chess_rooms r
    where r.id=p_room_id and r.host_id=actor) then
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
    from public.chess_friend_invites i
      join public.profiles p on p.id=i.invitee_id
    where i.room_id=p_room_id and i.inviter_id=actor
    order by i.created_at desc,i.id limit 50
  ) v;
  return output;
end;
$$;

create function public.chess_respond_friend_invite(actor uuid,p_invite_id uuid,p_accept boolean)
returns jsonb language plpgsql set search_path=''
as $$
declare
  original public.chess_friend_invites%rowtype;
  locked_invite public.chess_friend_invites%rowtype;
  locked_room public.chess_rooms%rowtype;
  checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_invite_id is null or p_accept is null then raise exception 'INVALID_ROOM_INVITE'; end if;

  -- Snapshot only locates lock targets; all security checks are repeated after
  -- locks. Profiles use NO KEY UPDATE so code-entry's profile FK KEY SHARE
  -- can proceed even when it already holds the room lock; Friends V1's
  -- FOR UPDATE still serializes block/unfriend transitions.
  select * into original from public.chess_friend_invites where id=p_invite_id;
  if not found or original.invitee_id<>actor then
    raise exception 'ROOM_INVITE_NOT_FOUND'; end if;
  perform 1 from public.profiles
    where id in (original.inviter_id,actor) order by id for no key update;
  select * into locked_room from public.chess_rooms where id=original.room_id for update;
  select * into locked_invite from public.chess_friend_invites
    where id=p_invite_id for update;
  checked_at:=clock_timestamp();
  if not found or locked_invite.invitee_id<>actor
    or locked_invite.room_id<>original.room_id
    or locked_invite.inviter_id<>original.inviter_id
  then raise exception 'ROOM_INVITE_NOT_FOUND'; end if;

  if p_accept and locked_invite.status='accepted'
    and locked_room.guest_id=actor and locked_room.closed_at is null then
    return jsonb_build_object('inviteId',locked_invite.id,'status','accepted','roomId',locked_room.id);
  end if;
  if not p_accept and locked_invite.status='declined' then
    return jsonb_build_object('inviteId',locked_invite.id,'status','declined','roomId',null);
  end if;
  if locked_invite.status<>'pending'
    or locked_invite.expires_at<=checked_at
    or locked_room.id is null or locked_room.host_id<>locked_invite.inviter_id
    or locked_room.closed_at is not null or locked_room.expires_at<=checked_at
    or exists(select 1 from public.chess_matches m where m.room_id=locked_room.id)
    or not exists(select 1 from public.friend_links f
      where f.status='accepted' and f.updated_at<=locked_invite.created_at
      and ((f.requester_id=actor and f.recipient_id=locked_invite.inviter_id)
        or (f.requester_id=locked_invite.inviter_id and f.recipient_id=actor)))
    or exists(select 1 from public.player_blocks b
      where (b.blocker_id=actor and b.blocked_id=locked_invite.inviter_id)
         or (b.blocker_id=locked_invite.inviter_id and b.blocked_id=actor))
  then raise exception 'ROOM_INVITE_NOT_FOUND'; end if;

  if p_accept then
    -- Use the regular join function under the room lock to preserve capacity.
    if locked_room.guest_id is not null and locked_room.guest_id<>actor then
      raise exception 'ROOM_NOT_AVAILABLE';
    end if;
    perform public.chess_join_room(actor,locked_room.code);
  end if;
  update public.chess_friend_invites
    set status=case when p_accept then 'accepted' else 'declined' end,
      responded_at=checked_at
    where id=locked_invite.id;
  return jsonb_build_object('inviteId',locked_invite.id,
    'status',case when p_accept then 'accepted' else 'declined' end,
    'roomId',case when p_accept then locked_room.id else null end);
end;
$$;

revoke all on function public.chess_send_friend_invite(uuid,uuid,uuid),
  public.chess_list_received_invites(uuid),
  public.chess_list_sent_invites(uuid,uuid),
  public.chess_respond_friend_invite(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.chess_send_friend_invite(uuid,uuid,uuid),
  public.chess_list_received_invites(uuid),
  public.chess_list_sent_invites(uuid,uuid),
  public.chess_respond_friend_invite(uuid,uuid,boolean) to service_role;
commit;
