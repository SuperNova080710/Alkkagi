begin;

-- v0.3.0 Omok friend invitations (#221); depends on Omok core + Friends V1.
-- Private invitation state: no direct client table access.
create table public.omok_friend_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.omok_rooms(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '5 minutes'),
  responded_at timestamptz,
  unique(room_id,invitee_id),
  check(inviter_id<>invitee_id),
  check(expires_at>created_at),
  check((status='pending' and responded_at is null) or
        (status in('accepted','declined') and responded_at is not null))
);
create index omok_friend_invites_target_idx on public.omok_friend_invites(invitee_id,created_at desc);
create index omok_friend_invites_sender_idx on public.omok_friend_invites(inviter_id,created_at desc);
alter table public.omok_friend_invites enable row level security;
revoke all on public.omok_friend_invites from public,anon,authenticated;
grant all on public.omok_friend_invites to service_role;

create function public.send_omok_friend_invite(p_room_id uuid,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  host uuid;
  room public.omok_rooms%rowtype;
  existing public.omok_friend_invites%rowtype;
  invite_id uuid;
  checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_room_id is null or p_target_id is null or actor=p_target_id then
    raise exception 'INVALID_ROOM_INVITE'; end if;
  select owner_id into host from public.omok_rooms where id=p_room_id;
  if host is distinct from actor then raise exception 'ROOM_NOT_AVAILABLE'; end if;
  -- Lock profiles before room: same order as friends mutation RPCs.
  perform 1 from public.profiles where id in(actor,p_target_id)
    order by id for no key update;
  if (select count(*) from public.profiles where id in(actor,p_target_id))<>2 then
    raise exception 'FRIEND_NOT_AVAILABLE'; end if;
  select * into room from public.omok_rooms where id=p_room_id for update;
  checked_at:=clock_timestamp();
  if not found or room.owner_id<>actor or room.status<>'waiting'
    or room.expires_at<=checked_at
    or not exists(select 1 from public.omok_room_players rp
      where rp.room_id=p_room_id and rp.user_id=actor and rp.seat=1)
    or exists(select 1 from public.omok_room_players rp
      where rp.room_id=p_room_id and rp.seat=2)
    or exists(select 1 from public.omok_matches m where m.room_id=p_room_id)
  then raise exception 'ROOM_NOT_AVAILABLE'; end if;
  if not exists(select 1 from public.friend_links f
      where f.status='accepted' and
      ((f.requester_id=actor and f.recipient_id=p_target_id)
       or (f.recipient_id=actor and f.requester_id=p_target_id)))
    or exists(select 1 from public.player_blocks b
      where (b.blocker_id=actor and b.blocked_id=p_target_id)
        or (b.blocker_id=p_target_id and b.blocked_id=actor))
  then raise exception 'FRIEND_NOT_AVAILABLE'; end if;

  select * into existing from public.omok_friend_invites
    where room_id=p_room_id and invitee_id=p_target_id for update;
  if found then
    if existing.status='pending' and existing.expires_at>checked_at then
      return jsonb_build_object('inviteId',existing.id,'status','pending','alreadyPending',true);
    end if;
    raise exception 'ROOM_INVITE_ALREADY_SENT';
  end if;
  if (select count(*) from public.omok_friend_invites
      where inviter_id=actor and created_at>checked_at-interval '10 minutes')>=20
    or (select count(*) from public.omok_friend_invites
      where inviter_id=actor and status='pending' and expires_at>checked_at)>=10 then
    raise exception 'ROOM_INVITE_RATE_LIMIT'; end if;
  if (select count(*) from public.omok_friend_invites
      where invitee_id=p_target_id and status='pending' and expires_at>checked_at)>=20 then
    raise exception 'ROOM_INVITE_INBOX_FULL'; end if;
  insert into public.omok_friend_invites(room_id,inviter_id,invitee_id)
    values(p_room_id,actor,p_target_id) returning id into invite_id;
  return jsonb_build_object('inviteId',invite_id,'status','pending','alreadyPending',false);
end;
$$;

create function public.list_omok_received_invites()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v."createdAt" desc,v.id),'[]'::jsonb)
    into result from (
      select i.id,i.room_id as "roomId",i.inviter_id as "inviterId",
        p.nickname as "inviterNickname",i.created_at as "createdAt",
        i.expires_at as "expiresAt"
      from public.omok_friend_invites i
        join public.omok_rooms r on r.id=i.room_id
        join public.profiles p on p.id=i.inviter_id
      where i.invitee_id=actor and i.status='pending'
        and i.expires_at>now() and r.expires_at>now()
        and r.status='waiting' and r.owner_id=i.inviter_id
        and not exists(select 1 from public.omok_room_players rp
          where rp.room_id=r.id and rp.seat=2)
        and exists(select 1 from public.friend_links f
          where f.status='accepted' and
            ((f.requester_id=i.inviter_id and f.recipient_id=actor)
             or (f.recipient_id=i.inviter_id and f.requester_id=actor)))
        and not exists(select 1 from public.player_blocks b
          where (b.blocker_id=actor and b.blocked_id=i.inviter_id)
             or (b.blocker_id=i.inviter_id and b.blocked_id=actor))
      order by i.created_at desc,i.id limit 20
    ) v;
  return result;
end;
$$;

create function public.respond_omok_friend_invite(p_invite_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invite public.omok_friend_invites%rowtype;
  room public.omok_rooms%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_invite_id is null or p_accept is null then raise exception 'INVALID_ROOM_INVITE'; end if;
  select * into invite from public.omok_friend_invites where id=p_invite_id;
  if not found or invite.invitee_id<>actor or invite.status<>'pending' then
    raise exception 'ROOM_INVITE_NOT_FOUND'; end if;
  perform 1 from public.profiles where id in(actor,invite.inviter_id)
    order by id for no key update;
  select * into room from public.omok_rooms where id=invite.room_id for update;
  select * into invite from public.omok_friend_invites where id=p_invite_id for update;
  if not found or invite.invitee_id<>actor or invite.status<>'pending' or
      invite.expires_at<=clock_timestamp() or room.owner_id<>invite.inviter_id
      or room.status<>'waiting' or room.expires_at<=clock_timestamp() then
    raise exception 'ROOM_INVITE_NOT_FOUND'; end if;
  if not exists(select 1 from public.friend_links f
      where f.status='accepted' and
      ((f.requester_id=actor and f.recipient_id=invite.inviter_id)
       or (f.recipient_id=actor and f.requester_id=invite.inviter_id)))
    or exists(select 1 from public.player_blocks b
      where (b.blocker_id=actor and b.blocked_id=invite.inviter_id)
         or (b.blocker_id=invite.inviter_id and b.blocked_id=actor))
  then raise exception 'ROOM_INVITE_NOT_FOUND'; end if;

  if p_accept then
    -- Regular join RPC owns the room capacity and expiration invariants.
    perform public.join_omok_room(room.code);
  end if;
  update public.omok_friend_invites set status=case when p_accept then 'accepted' else 'declined' end,
    responded_at=now() where id=p_invite_id;
  return jsonb_build_object('inviteId',invite.id,
    'status',case when p_accept then 'accepted' else 'declined' end,
    'roomId',case when p_accept then room.id else null end);
end;
$$;

revoke all on function public.send_omok_friend_invite(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.list_omok_received_invites()
  from public,anon,authenticated;
revoke all on function public.respond_omok_friend_invite(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.send_omok_friend_invite(uuid,uuid) to authenticated;
grant execute on function public.list_omok_received_invites() to authenticated;
grant execute on function public.respond_omok_friend_invite(uuid,boolean) to authenticated;

-- Not a realtime publication: private invitation state is exposed only
-- through authenticated, guarded RPCs and client polling.
commit;
