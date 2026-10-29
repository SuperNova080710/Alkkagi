begin;
-- Solo AI practice reuses an existing waiting casual room, not a fake auth user.
-- The opponent is a deterministic sentinel, never a public.profiles row.
create table public.ai_matches(
 room_id uuid primary key references public.rooms(id) on delete cascade,
 owner_id uuid not null references public.profiles(id),
 difficulty text not null check(difficulty in('easy','normal','hard')),
 status text not null default 'active' check(status in('active','finished')),
 board_state jsonb not null check(jsonb_typeof(board_state)='object'),
 turn_no integer not null default 1 check(turn_no>=1),
 winner_id uuid,
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 check(winner_id is null or winner_id=owner_id or winner_id='00000000-0000-4000-8000-0000000000a1'::uuid),
 check((status='active' and finished_at is null and winner_id is null)
    or (status='finished' and finished_at is not null))
);
create index ai_matches_owner_state_idx on public.ai_matches(owner_id,status,created_at desc);
create table public.ai_turns(
 room_id uuid not null references public.ai_matches(room_id) on delete cascade,
 turn_no integer not null check(turn_no>=1),
 human_input jsonb not null,
 human_frames jsonb not null,
 ai_input jsonb,
 ai_frames jsonb,
 result_state jsonb not null,
 created_at timestamptz not null default now(),
 primary key(room_id,turn_no)
);
create index ai_turns_recent_idx on public.ai_turns(room_id,turn_no desc);
alter table public.ai_matches enable row level security;
alter table public.ai_turns enable row level security;
revoke all on public.ai_matches,public.ai_turns from public,anon,authenticated;
grant select on public.ai_matches,public.ai_turns to authenticated;
grant all on public.ai_matches,public.ai_turns to service_role;
create policy ai_matches_owner_read on public.ai_matches for select to authenticated
 using(owner_id=(select auth.uid()));
create policy ai_turns_owner_read on public.ai_turns for select to authenticated
 using(exists(select 1 from public.ai_matches am
 where am.room_id=ai_turns.room_id and am.owner_id=(select auth.uid())));

-- A host-only authenticated RPC locks the existing room so a friend cannot
-- simultaneously occupy seat 2 while the AI replaces the waiting guest.
create function public.start_ai_room(p_room_id uuid,p_difficulty text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); r public.rooms%rowtype; pieces jsonb;
 bot constant uuid:='00000000-0000-4000-8000-0000000000a1';
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_difficulty not in ('easy','normal','hard') then raise exception 'INVALID_DIFFICULTY'; end if;
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.owner_id<>actor then raise exception 'NOT_HOST'; end if;
 if r.status<>'waiting' or r.expires_at<=now() then raise exception 'ROOM_UNAVAILABLE'; end if;
 if (select count(*) from public.room_players where room_id=r.id)<>1
  or not exists(select 1 from public.room_players where room_id=r.id and user_id=actor and seat=1)
 then raise exception 'ROOM_HAS_GUEST'; end if;
 if exists(select 1 from public.matches where room_id=r.id)
  or exists(select 1 from public.ai_matches where room_id=r.id)
 then raise exception 'ROOM_STARTED'; end if;
 select jsonb_agg(jsonb_build_object('id',piece_id,'owner',owner,'x',x,'y',y) order by piece_id)
 into pieces from(
  select 'a'||n as piece_id,actor as owner,175::float8 as x,(70+n*60)::float8 as y
  from generate_series(1,5) n
  union all
  select 'b'||n,bot,625::float8,(70+n*60)::float8
  from generate_series(1,5) n
 ) start_board;
 insert into public.ai_matches(room_id,owner_id,difficulty,board_state)
 values(r.id,actor,p_difficulty,jsonb_build_object('pieces',pieces));
 update public.rooms set status='playing' where id=r.id;
 return r.id;
end;
$$;
revoke all on function public.start_ai_room(uuid,text) from public,anon;
grant execute on function public.start_ai_room(uuid,text) to authenticated;

-- Service-role-only atomic commit: same expected snapshot and turn number.
-- Both player's physics and the computer reply are computed on the server.
create function public.commit_ai_turn(
 p_room_id uuid,p_actor uuid,p_turn integer,p_expected jsonb,
 p_human_input jsonb,p_human_frames jsonb,p_ai_input jsonb,p_ai_frames jsonb,
 p_final jsonb,p_finished boolean,p_winner uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare m public.ai_matches%rowtype;
 bot constant uuid:='00000000-0000-4000-8000-0000000000a1';
begin
 select * into m from public.ai_matches where room_id=p_room_id for update;
 if not found or m.owner_id<>p_actor then raise exception 'AI_MATCH_NOT_FOUND'; end if;
 if m.status<>'active' or m.turn_no<>p_turn or m.board_state is distinct from p_expected
 then raise exception 'STALE_AI_TURN'; end if;
 if jsonb_typeof(p_final->'pieces')<>'array' or jsonb_typeof(p_human_frames)<>'array'
 then raise exception 'INVALID_AI_BOARD'; end if;
 if (p_ai_input is null)<>(p_ai_frames is null) then raise exception 'INVALID_AI_REPLY'; end if;
 if p_finished is not true and p_winner is not null then raise exception 'INVALID_AI_WINNER'; end if;
 if p_winner is not null and p_winner not in(p_actor,bot) then raise exception 'INVALID_AI_WINNER'; end if;
 update public.ai_matches set board_state=p_final,turn_no=turn_no+1,
   status=case when p_finished then 'finished' else 'active' end,
   winner_id=case when p_finished then p_winner else null end,
   finished_at=case when p_finished then now() else null end
 where room_id=p_room_id;
 insert into public.ai_turns(room_id,turn_no,human_input,human_frames,
 ai_input,ai_frames,result_state)
 values(p_room_id,p_turn,p_human_input,p_human_frames,p_ai_input,p_ai_frames,p_final);
 return jsonb_build_object('turnNo',p_turn+1,'finished',p_finished,'winnerId',p_winner);
end;
$$;
create function public.forfeit_ai_match(p_room_id uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare m public.ai_matches%rowtype;
begin
 select * into m from public.ai_matches where room_id=p_room_id for update;
 if not found or m.owner_id<>p_actor then raise exception 'AI_MATCH_NOT_FOUND'; end if;
 if m.status<>'active' then raise exception 'AI_MATCH_FINISHED'; end if;
 update public.ai_matches set status='finished',winner_id='00000000-0000-4000-8000-0000000000a1',
 finished_at=now() where room_id=p_room_id;
 return true;
end;
$$;
revoke all on function public.commit_ai_turn
 from public,anon,authenticated;
revoke all on function public.forfeit_ai_match(uuid,uuid) from public,anon,authenticated;
grant execute on function public.commit_ai_turn(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,uuid) to service_role;
grant execute on function public.forfeit_ai_match(uuid,uuid) to service_role;
alter publication supabase_realtime add table public.ai_matches;
commit;
