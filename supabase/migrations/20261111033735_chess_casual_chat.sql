begin;

create table public.chess_match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.chess_matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  request_id uuid not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default clock_timestamp(),
  unique (match_id,sender_id,request_id)
);
create index chess_match_messages_recent_idx on public.chess_match_messages(match_id,created_at desc,id desc);
create index chess_match_messages_sender_idx on public.chess_match_messages(sender_id,created_at desc);

alter table public.chess_match_messages enable row level security;
revoke all on public.chess_match_messages from public,anon,authenticated,service_role;
grant select on public.chess_match_messages to authenticated;
grant select,insert on public.chess_match_messages to service_role;
create policy chess_match_messages_participants on public.chess_match_messages for select to authenticated
  using (exists (
    select 1 from public.chess_matches m where m.id=chess_match_messages.match_id
      and m.mode='casual' and (select auth.uid()) in (m.white_id,m.black_id)
  ));

create function public.chess_chat_history(p_match_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare game_mode text;
begin
  select m.mode into game_mode from public.chess_matches m where m.id=p_match_id
    and (select auth.uid()) in (m.white_id,m.black_id);
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if game_mode<>'casual' then raise exception 'CHAT_NOT_AVAILABLE'; end if;

  return (select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at,recent.id),'[]'::jsonb)
    from (select id,sender_id,body,created_at from public.chess_match_messages
      where match_id=p_match_id order by created_at desc,id desc limit 100) recent);
end;
$$;

create function public.chess_send_chat_message(p_actor uuid,p_match_id uuid,p_body text,p_request_id uuid)
returns uuid language plpgsql set search_path='' as $$
declare
  game public.chess_matches%rowtype;
  existing public.chess_match_messages%rowtype;
  clean_body text:=btrim(p_body,E' \t\n\r\f\013');
  sent_at timestamptz;
  message_id uuid;
begin
  -- The match lock makes membership, close time and the per-match cap atomic.
  select * into game from public.chess_matches where id=p_match_id for update;
  if not found or p_actor is null or p_actor not in (game.white_id,game.black_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  if game.mode<>'casual' then raise exception 'CHAT_NOT_AVAILABLE'; end if;
  if clean_body is null or char_length(clean_body) not between 1 and 280 or p_request_id is null
  then raise exception 'INVALID_MESSAGE'; end if;

  select * into existing from public.chess_match_messages
    where match_id=p_match_id and sender_id=p_actor and request_id=p_request_id;
  if found then
    if existing.body is distinct from clean_body then raise exception 'REQUEST_CONFLICT'; end if;
    return existing.id;
  end if;

  -- Serialize one sender across matches without locking unrelated profiles.
  perform pg_advisory_xact_lock(hashtextextended('chess-chat:'||p_actor::text,0));
  sent_at:=clock_timestamp();
  if game.finished_at is not null and game.finished_at<=sent_at-interval '30 minutes'
  then raise exception 'CHAT_CLOSED'; end if;
  if exists(select 1 from public.chess_match_messages
    where sender_id=p_actor and created_at>sent_at-interval '1 second')
  then raise exception 'CHAT_RATE_LIMIT'; end if;
  if (select count(*) from public.chess_match_messages where match_id=p_match_id)>=500
  then raise exception 'CHAT_FULL'; end if;

  insert into public.chess_match_messages(match_id,sender_id,request_id,body,created_at)
    values(p_match_id,p_actor,p_request_id,clean_body,sent_at) returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.chess_chat_history(uuid),public.chess_send_chat_message(uuid,uuid,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.chess_chat_history(uuid) to authenticated;
grant execute on function public.chess_send_chat_message(uuid,uuid,text,uuid) to service_role;
alter publication supabase_realtime add table public.chess_match_messages;

commit;
