begin;
create table public.match_messages (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references public.matches(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),
 body text not null check(char_length(body) between 1 and 280 and body=btrim(body)),
 created_at timestamptz not null default now()
);
create index match_messages_recent_idx on public.match_messages(match_id,created_at desc,id desc);
alter table public.match_messages enable row level security;
revoke all on public.match_messages from public,anon,authenticated;
grant select on public.match_messages to authenticated;
grant all on public.match_messages to service_role;
create policy match_messages_participants_read on public.match_messages for select to authenticated
 using(exists(select 1 from public.matches m where m.id=match_messages.match_id
 and (select auth.uid()) in(m.player1_id,m.player2_id)));
create function public.send_match_message(p_match_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); game public.matches%rowtype;
 message text; new_id uuid; last_message timestamptz;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 message:=btrim(p_body);
 if message is null or char_length(message) not between 1 and 280 then raise exception 'MESSAGE_INVALID'; end if;
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 select * into game from public.matches where id=p_match_id;
 if not found or actor not in(game.player1_id,game.player2_id) then raise exception 'MATCH_NOT_FOUND'; end if;
 if game.status<>'active' and not (game.status='finished'
 and game.finished_at>now()-interval '30 minutes') then raise exception 'CHAT_CLOSED'; end if;
 select created_at into last_message from public.match_messages
 where sender_id=actor order by created_at desc,id desc limit 1;
 if last_message>now()-interval '1 second' then raise exception 'CHAT_RATE_LIMIT'; end if;
 if (select count(*) from public.match_messages where match_id=p_match_id)>=500 then raise exception 'CHAT_FULL'; end if;
 insert into public.match_messages(match_id,sender_id,body)
 values(p_match_id,actor,message) returning id into new_id;
 return new_id;
end;
$$;
revoke all on function public.send_match_message(uuid,text) from public,anon;
grant execute on function public.send_match_message(uuid,text) to authenticated;
alter publication supabase_realtime add table public.match_messages;
commit;
