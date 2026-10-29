begin;

-- DM V1 (#78). No client-controlled sender, friendship or read cursor.
create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_low, user_high),
  check (user_low < user_high)
);
create index dm_threads_high_idx on public.dm_threads(user_high);

create table public.dm_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique(thread_id, sender_id, request_id)
);
create index dm_messages_page_idx on public.dm_messages(thread_id,id desc);
create index dm_messages_throttle_idx on public.dm_messages(thread_id,sender_id,created_at desc);

create table public.dm_read_state (
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_id bigint not null default 0 check (last_read_id >= 0),
  updated_at timestamptz not null default now(),
  primary key(thread_id,user_id)
);
create index dm_read_state_user_idx on public.dm_read_state(user_id);

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_read_state enable row level security;

revoke all on public.dm_threads,public.dm_messages,public.dm_read_state
  from public,anon,authenticated;
grant select on public.dm_threads,public.dm_messages to authenticated;
grant all on public.dm_threads,public.dm_messages,public.dm_read_state to service_role;

-- SECURITY DEFINER is confined to a yes/no check on the *authenticated* user.
-- Own relationship may be checked, but emails/blocks/hidden player data never leave.
create function public.dm_friend_allowed(p_peer uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or p_peer is null or actor=p_peer then return false; end if;
  return exists (
    select 1 from public.friend_links l
    where l.status='accepted'
      and ((l.requester_id=actor and l.recipient_id=p_peer)
        or (l.requester_id=p_peer and l.recipient_id=actor))
  ) and not exists (
    select 1 from public.player_blocks b
    where (b.blocker_id=actor and b.blocked_id=p_peer)
       or (b.blocker_id=p_peer and b.blocked_id=actor)
  );
end;
$$;
revoke all on function public.dm_friend_allowed(uuid) from public,anon,authenticated;
grant execute on function public.dm_friend_allowed(uuid) to authenticated;

create policy dm_threads_active_friend_read on public.dm_threads
  for select to authenticated using (
    (user_low=(select auth.uid()) and (select public.dm_friend_allowed(user_high)))
    or
    (user_high=(select auth.uid()) and (select public.dm_friend_allowed(user_low)))
  );
-- Realtime Postgres Changes applies SELECT RLS for each delivered INSERT.
create policy dm_messages_active_friend_read on public.dm_messages
  for select to authenticated using (
    exists(select 1 from public.dm_threads t where t.id=dm_messages.thread_id)
  );
-- Read markers have NO direct client SELECT/WRITE surface.

create function public.send_direct_message(p_peer uuid,p_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  tid uuid;
  existing public.dm_messages%rowtype;
  saved public.dm_messages%rowtype;
  last_sent timestamptz;
  current_time timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_peer is null or actor=p_peer then raise exception 'DM_NOT_AVAILABLE'; end if;
  if p_request_id is null or p_body is null
     or char_length(btrim(p_body)) not between 1 and 500 then
    raise exception 'DM_INVALID_MESSAGE';
  end if;
  -- All friendship/block mutations use the same sorted profile lock order.
  perform 1 from public.profiles where id in(actor,p_peer) order by id for update;
  if not public.dm_friend_allowed(p_peer) then raise exception 'DM_NOT_AVAILABLE'; end if;

  insert into public.dm_threads(user_low,user_high)
  values(least(actor,p_peer),greatest(actor,p_peer)) on conflict do nothing;
  select id into tid from public.dm_threads
    where user_low=least(actor,p_peer) and user_high=greatest(actor,p_peer)
    for update;

  -- Retries are idempotent, even when the sender is currently throttled.
  select * into existing from public.dm_messages
    where thread_id=tid and sender_id=actor and request_id=p_request_id;
  if found then
    return jsonb_build_object('threadId',tid,'id',existing.id::text,
      'senderId',actor,'body',existing.body,'createdAt',existing.created_at,
      'alreadySent',true);
  end if;

  current_time:=clock_timestamp();
  select created_at into last_sent from public.dm_messages
    where thread_id=tid and sender_id=actor
    order by created_at desc,id desc limit 1;
  if last_sent > current_time - interval '1 second' then
    raise exception 'DM_RATE_LIMIT';
  end if;
  if (select count(*) from public.dm_messages m where m.thread_id=tid) >= 5000 then
    raise exception 'DM_THREAD_FULL';
  end if;
  if (select count(*) from public.dm_messages m
    where m.thread_id=tid and m.sender_id=actor
      and m.created_at > current_time - interval '24 hours') >= 200 then
    raise exception 'DM_DAILY_LIMIT';
  end if;
  insert into public.dm_messages(thread_id,sender_id,request_id,body)
    values(tid,actor,p_request_id,btrim(p_body)) returning * into saved;
  return jsonb_build_object('threadId',tid,'id',saved.id::text,
    'senderId',actor,'body',saved.body,'createdAt',saved.created_at,
    'alreadySent',false);
end;
$$;

create function public.get_direct_messages(
  p_peer uuid,p_before_id bigint default null,p_limit integer default 30
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  tid uuid;
  messages_json jsonb;
  has_more boolean;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_peer is null or p_peer=actor or not public.dm_friend_allowed(p_peer)
    then raise exception 'DM_NOT_AVAILABLE'; end if;
  if p_limit is null or p_limit<1 or p_limit>50
     or (p_before_id is not null and p_before_id<=0)
    then raise exception 'DM_INVALID_PAGE'; end if;
  select id into tid from public.dm_threads
    where user_low=least(actor,p_peer) and user_high=greatest(actor,p_peer);
  if tid is null then return jsonb_build_object('threadId',null,'messages','[]'::jsonb,'hasMore',false); end if;

  with page as (
    select m.id,m.sender_id,m.body,m.created_at from public.dm_messages m
    where m.thread_id=tid and (p_before_id is null or m.id<p_before_id)
    order by m.id desc limit p_limit+1
  ), numbered as (
    select page.*,row_number() over (order by page.id desc) as rn from page
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id::text,
    'senderId',n.sender_id,'body',n.body,'createdAt',n.created_at)
    order by n.id desc) filter (where n.rn<=p_limit),'[]'::jsonb),
    count(*)>p_limit
  into messages_json,has_more from numbered n;
  return jsonb_build_object('threadId',tid,'messages',messages_json,'hasMore',has_more);
end;
$$;

create function public.mark_direct_messages_read(p_peer uuid,p_message_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();tid uuid;value_id bigint;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_peer is null or p_peer=actor or not public.dm_friend_allowed(p_peer)
    then raise exception 'DM_NOT_AVAILABLE'; end if;
  if p_message_id is null or p_message_id<=0 then raise exception 'DM_INVALID_MESSAGE_ID'; end if;
  select id into tid from public.dm_threads
    where user_low=least(actor,p_peer) and user_high=greatest(actor,p_peer);
  if tid is null or not exists(select 1 from public.dm_messages
      where thread_id=tid and id=p_message_id) then
    raise exception 'DM_INVALID_MESSAGE_ID';
  end if;
  insert into public.dm_read_state(thread_id,user_id,last_read_id)
    values(tid,actor,p_message_id)
  on conflict(thread_id,user_id) do update
    set last_read_id=greatest(public.dm_read_state.last_read_id,excluded.last_read_id),
        updated_at=now()
  returning last_read_id into value_id;
  return jsonb_build_object('threadId',tid,'lastReadId',value_id::text);
end;
$$;

create function public.get_direct_message_inbox()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();output jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x."lastAt" desc nulls last,x."threadId"),'[]'::jsonb)
    into output from (
    select t.id as "threadId",p.id as "userId",p.nickname,
      last_msg.created_at as "lastAt",
      case when last_msg.id is null then null else
        jsonb_build_object('id',last_msg.id::text,'senderId',last_msg.sender_id,
          'body',last_msg.body,'createdAt',last_msg.created_at) end as "lastMessage",
      (select count(*) from public.dm_messages unread
        where unread.thread_id=t.id and unread.sender_id<>actor
          and unread.id>coalesce(rs.last_read_id,0))::integer as "unreadCount"
    from public.dm_threads t
    join public.profiles p on p.id=case when t.user_low=actor
      then t.user_high else t.user_low end
    left join public.dm_read_state rs on rs.thread_id=t.id and rs.user_id=actor
    left join lateral (
      select m.id,m.sender_id,m.body,m.created_at
      from public.dm_messages m where m.thread_id=t.id
      order by m.id desc limit 1
    ) last_msg on true
    where actor in(t.user_low,t.user_high)
      and public.dm_friend_allowed(p.id)
    order by last_msg.created_at desc nulls last,t.id limit 100
  ) x;
  return output;
end;
$$;

revoke all on function public.send_direct_message(uuid,text,uuid),
  public.get_direct_messages(uuid,bigint,integer),
  public.mark_direct_messages_read(uuid,bigint),
  public.get_direct_message_inbox() from public,anon,authenticated;
grant execute on function public.send_direct_message(uuid,text,uuid),
  public.get_direct_messages(uuid,bigint,integer),
  public.mark_direct_messages_read(uuid,bigint),
  public.get_direct_message_inbox() to authenticated;

-- Realtime supplies INSERT events only to clients passing dm_messages SELECT RLS.
-- Never use DELETE events for private data (DELETE is not RLS-filtered).
alter publication supabase_realtime add table public.dm_threads;
alter publication supabase_realtime add table public.dm_messages;
commit;
