begin;

-- v0.3.0 Omok AI matches (#222); isolated from Alkkagi AI and ranked rating.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create table public.omok_ai_matches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  difficulty text not null check(difficulty in('easy','normal','hard')),
  board_state jsonb not null check(jsonb_typeof(board_state)='array'
    and jsonb_array_length(board_state)=15),
  turn_no integer not null default 1 check(turn_no between 1 and 114),
  status text not null default 'active' check(status in('active','finished')),
  winner text check(winner in('human','ai')),
  finish_reason text check(finish_reason in('five','draw','forfeit')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check((status='active' and winner is null and finish_reason is null and finished_at is null)
    or (status='finished' and finish_reason is not null and finished_at is not null)),
  check(finish_reason is distinct from 'draw' or winner is null)
);
create index omok_ai_matches_owner_idx on public.omok_ai_matches(owner_id,created_at desc);

create table public.omok_ai_turns (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.omok_ai_matches(id) on delete cascade,
  turn_no integer not null check(turn_no between 1 and 113),
  request_id uuid not null,
  human_row smallint not null check(human_row between 0 and 14),
  human_col smallint not null check(human_col between 0 and 14),
  ai_row smallint check(ai_row between 0 and 14),
  ai_col smallint check(ai_col between 0 and 14),
  created_at timestamptz not null default now(),
  unique(match_id,turn_no),
  unique(match_id,request_id),
  check((ai_row is null)=(ai_col is null))
);

alter table public.omok_ai_matches enable row level security;
alter table public.omok_ai_turns enable row level security;
revoke all on public.omok_ai_matches,public.omok_ai_turns from public,anon,authenticated;
grant select on public.omok_ai_matches,public.omok_ai_turns to authenticated;
grant all on public.omok_ai_matches,public.omok_ai_turns to service_role;
revoke all on sequence public.omok_ai_turns_id_seq from public,anon,authenticated;
grant usage,select on sequence public.omok_ai_turns_id_seq to service_role;
create policy omok_ai_matches_read_owner on public.omok_ai_matches for select to authenticated
  using(owner_id=(select auth.uid()));
create policy omok_ai_turns_read_owner on public.omok_ai_turns for select to authenticated
  using(exists(select 1 from public.omok_ai_matches m
    where m.id=omok_ai_turns.match_id and m.owner_id=(select auth.uid())));

-- Shared deterministic rule evaluator used only by privileged turn settlement.
create function private.omok_has_five(
  p_board jsonb,p_row integer,p_col integer,p_color text
) returns boolean language plpgsql immutable set search_path='' as $$
declare direction integer; dr integer; dc integer; sign_step integer;
  r integer; c integer; line_count integer;
begin
  if p_color not in('black','white') or p_board is null or
      p_row not between 0 and 14 or p_col not between 0 and 14 or
      p_board #>> array[p_row::text,p_col::text] is distinct from p_color then
    return false;
  end if;
  for direction in 1..4 loop
    dr:=case direction when 1 then 0 else 1 end;
    dc:=case direction when 1 then 1 when 2 then 0 when 3 then 1 else -1 end;
    line_count:=1;
    for sign_step in -1..1 loop
      if sign_step=0 then continue; end if;
      r:=p_row+dr*sign_step; c:=p_col+dc*sign_step;
      while r between 0 and 14 and c between 0 and 14 loop
        exit when p_board #>> array[r::text,c::text] is distinct from p_color;
        line_count:=line_count+1;
        r:=r+dr*sign_step; c:=c+dc*sign_step;
      end loop;
    end loop;
    if line_count>=5 then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function private.omok_has_five(jsonb,integer,integer,text)
  from public,anon,authenticated,service_role;

create function public.create_omok_ai_match(p_difficulty text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); match_id uuid; checked_at timestamptz;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_difficulty is null or p_difficulty not in('easy','normal','hard') then
    raise exception 'INVALID_DIFFICULTY'; end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  checked_at:=clock_timestamp();
  if (select count(*) from public.omok_ai_matches
    where owner_id=actor and status='active')>=3 then
    raise exception 'AI_ACTIVE_LIMIT'; end if;
  if (select count(*) from public.omok_ai_matches
    where owner_id=actor and created_at>checked_at-interval '10 minutes')>=20 then
    raise exception 'AI_RATE_LIMIT'; end if;
  insert into public.omok_ai_matches(owner_id,difficulty,board_state)
    values(actor,p_difficulty,to_jsonb(array_fill(null::text,array[15,15])))
    returning id into match_id;
  return match_id;
end;
$$;

-- Server only. p_actor is the verified Auth user from Next.js, not client body.
-- The SQL recomputes win/draw and checks every stone and stale snapshot.
create function public.commit_omok_ai_turn(
  p_match_id uuid,p_actor uuid,p_request_id uuid,p_turn integer,
  p_expected_board jsonb,p_human_row integer,p_human_col integer,
  p_ai_row integer,p_ai_col integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  game public.omok_ai_matches%rowtype;
  previous public.omok_ai_turns%rowtype;
  board jsonb; result_winner text; reason text;
  human_win boolean:=false; ai_win boolean:=false; finished boolean:=false;
begin
  if p_match_id is null or p_actor is null or p_request_id is null then
    raise exception 'INVALID_REQUEST'; end if;
  select * into game from public.omok_ai_matches where id=p_match_id for update;
  if not found or game.owner_id<>p_actor then raise exception 'MATCH_NOT_FOUND'; end if;
  select * into previous from public.omok_ai_turns
    where match_id=p_match_id and request_id=p_request_id;
  if found then
    if previous.turn_no<>p_turn or previous.human_row<>p_human_row or
       previous.human_col<>p_human_col or
       previous.ai_row is distinct from p_ai_row or previous.ai_col is distinct from p_ai_col then
      raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',game.id,'status',game.status,'turnNo',game.turn_no,
      'winner',game.winner,'finishReason',game.finish_reason,
      'boardState',game.board_state,'replayed',true);
  end if;
  if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
  if game.turn_no<>p_turn or game.board_state is distinct from p_expected_board then
    raise exception 'STALE_TURN'; end if;
  if p_human_row is null or p_human_col is null or
      p_human_row not between 0 and 14 or p_human_col not between 0 and 14 then
    raise exception 'INVALID_MOVE'; end if;
  if game.board_state #>> array[p_human_row::text,p_human_col::text] is not null then
    raise exception 'CELL_OCCUPIED'; end if;
  board:=jsonb_set(game.board_state,array[p_human_row::text,p_human_col::text],
    to_jsonb('black'::text),false);
  human_win:=private.omok_has_five(board,p_human_row,p_human_col,'black');
  if human_win then
    result_winner:='human'; reason:='five'; finished:=true;
  elsif p_turn=113 then
    reason:='draw'; finished:=true;
  end if;
  if finished then
    if p_ai_row is not null or p_ai_col is not null then raise exception 'INVALID_AI_MOVE'; end if;
  else
    if p_ai_row is null or p_ai_col is null or p_ai_row not between 0 and 14
        or p_ai_col not between 0 and 14 then raise exception 'INVALID_AI_MOVE'; end if;
    if board #>> array[p_ai_row::text,p_ai_col::text] is not null then
      raise exception 'INVALID_AI_MOVE'; end if;
    board:=jsonb_set(board,array[p_ai_row::text,p_ai_col::text],
      to_jsonb('white'::text),false);
    ai_win:=private.omok_has_five(board,p_ai_row,p_ai_col,'white');
    if ai_win then
      result_winner:='ai'; reason:='five'; finished:=true;
    end if;
  end if;

  update public.omok_ai_matches set
    board_state=board,turn_no=p_turn+1,
    status=case when finished then 'finished' else 'active' end,
    winner=case when finished then result_winner else null end,
    finish_reason=case when finished then reason else null end,
    finished_at=case when finished then now() else null end
    where id=p_match_id;
  insert into public.omok_ai_turns(match_id,turn_no,request_id,human_row,human_col,ai_row,ai_col)
    values(p_match_id,p_turn,p_request_id,p_human_row,p_human_col,p_ai_row,p_ai_col);
  return jsonb_build_object('id',game.id,'status',case when finished then 'finished' else 'active' end,
    'turnNo',p_turn+1,'winner',result_winner,'finishReason',reason,
    'boardState',board,'replayed',false);
end;
$$;

create function public.forfeit_omok_ai_match(p_match_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game public.omok_ai_matches%rowtype;
begin
  if p_match_id is null or p_actor is null then raise exception 'INVALID_REQUEST'; end if;
  select * into game from public.omok_ai_matches where id=p_match_id for update;
  if not found or game.owner_id<>p_actor then raise exception 'MATCH_NOT_FOUND'; end if;
  if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
  update public.omok_ai_matches set status='finished',winner='ai',
    finish_reason='forfeit',finished_at=now() where id=p_match_id;
  return jsonb_build_object('winner','ai','finishReason','forfeit');
end;
$$;

revoke all on function public.create_omok_ai_match(text) from public,anon,authenticated;
grant execute on function public.create_omok_ai_match(text) to authenticated;
revoke all on function public.commit_omok_ai_turn(uuid,uuid,uuid,integer,jsonb,integer,integer,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.commit_omok_ai_turn(uuid,uuid,uuid,integer,jsonb,integer,integer,integer,integer)
  to service_role;
revoke all on function public.forfeit_omok_ai_match(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.forfeit_omok_ai_match(uuid,uuid) to service_role;

alter publication supabase_realtime add table public.omok_ai_matches;
commit;
