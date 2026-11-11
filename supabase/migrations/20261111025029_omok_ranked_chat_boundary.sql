begin;

-- Apply the casual-only chat rule to direct RPC calls and Realtime reads.
alter policy omok_match_messages_read_participants on public.omok_match_messages
  using(exists(select 1 from public.omok_matches m where m.id=omok_match_messages.match_id
    and m.mode='casual' and (select auth.uid()) in(m.black_id,m.white_id)));

create or replace function public.send_omok_match_message(
  p_match_id uuid,p_body text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  game public.omok_matches%rowtype;
  body_clean text;
  existing public.omok_match_messages%rowtype;
  last_time timestamptz;
  message_id uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or p_request_id is null then raise exception 'INVALID_MESSAGE'; end if;
  body_clean:=btrim(p_body);
  if body_clean is null or char_length(body_clean) not between 1 and 280
    then raise exception 'INVALID_MESSAGE'; end if;
  -- Serialize sender throttling across all Omok matches.
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  select * into game from public.omok_matches where id=p_match_id;
  if not found or actor not in(game.black_id,game.white_id) then raise exception 'MATCH_NOT_FOUND'; end if;
  if game.mode<>'casual' then raise exception 'CHAT_NOT_AVAILABLE'; end if;
  select * into existing from public.omok_match_messages
    where match_id=p_match_id and sender_id=actor and request_id=p_request_id;
  if found then
    if existing.body<>body_clean then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',existing.id,'replayed',true);
  end if;
  if game.status<>'active' and
    not (game.status='finished' and game.finished_at>now()-interval '30 minutes') then
    raise exception 'CHAT_CLOSED'; end if;
  select created_at into last_time from public.omok_match_messages
    where sender_id=actor order by created_at desc,id desc limit 1;
  if last_time>clock_timestamp()-interval '1 second' then raise exception 'CHAT_RATE_LIMIT'; end if;
  if (select count(*) from public.omok_match_messages
      where match_id=p_match_id)>=500 then raise exception 'CHAT_FULL'; end if;
  insert into public.omok_match_messages(match_id,sender_id,request_id,body)
    values(p_match_id,actor,p_request_id,body_clean) returning id into message_id;
  return jsonb_build_object('id',message_id,'replayed',false);
end;
$$;
commit;
