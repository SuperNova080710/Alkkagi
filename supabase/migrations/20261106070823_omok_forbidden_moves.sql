begin;

-- Existing snapshots retain freestyle. All creation paths use the new default,
-- including ranked matchmaking, casual rematches and AI replays.
alter table public.omok_matches add column rule_set text not null default 'freestyle'
  check (rule_set in ('freestyle', 'black_forbidden'));
alter table public.omok_ai_matches add column rule_set text not null default 'freestyle'
  check (rule_set in ('freestyle', 'black_forbidden'));
alter table public.omok_matches alter column rule_set set default 'black_forbidden';
alter table public.omok_ai_matches alter column rule_set set default 'black_forbidden';

-- Evaluate the newly placed black stone using RIF 9.1–9.3. The board is
-- authoritative and already contains the stone at (p_row,p_col).
create function private.omok_black_move_result(p_board jsonb, p_row integer, p_col integer)
returns text language plpgsql immutable set search_path='' as $$
declare
  row_steps constant integer[] := array[0,1,1,1];
  col_steps constant integer[] := array[1,0,1,-1];
  lines text[] := array[]::text[];
  axis integer;
  line text;
  delta integer;
  r integer;
  c integer;
  cell text;
  run integer;
  overline boolean := false;
  start_at integer;
  segment text;
  shape text;
  fours text[] := array[]::text[];
  threes text[] := array[]::text[];
  candidate_threes text[] := array[]::text[];
  candidate_rows integer[] := array[]::integer[];
  candidate_cols integer[] := array[]::integer[];
  valid_three text;
begin
  for axis in 1..4 loop
    line := '';
    for delta in -5..5 loop
      r := p_row + row_steps[axis]*delta;
      c := p_col + col_steps[axis]*delta;
      if r not between 0 and 14 or c not between 0 and 14 then
        line := line || 'x';
      else
        cell := p_board #>> array[r::text,c::text];
        line := line || case when cell='black' then 'b' when cell is null then '.' else 'x' end;
      end if;
    end loop;
    lines := array_append(lines,line);
    run := 1 + length(substring(reverse(left(line,5)) from '^b*')) +
      length(substring(substr(line,7) from '^b*'));
    -- An exact five takes priority over any foul on another axis.
    if run=5 then return 'five'; end if;
    overline := overline or run>5;
  end loop;
  if overline then return 'overline'; end if;

  for axis in 1..4 loop
    line := lines[axis];
    -- Two completions of the same open four share a stone-position mask.
    -- Separate fours on the same axis have different masks.
    for start_at in 2..6 loop
      segment := substr(line,start_at,5);
      if segment !~ '^[b.]{5}$' or length(replace(segment,'b',''))<>1 or
         substr(line,start_at-1,1)='b' or substr(line,start_at+5,1)='b' then continue; end if;
      shape := axis::text || ':' || rpad(lpad(segment,start_at+4,'.'),11,'.');
      if shape=any(fours) then continue; end if;
      if cardinality(fours)=1 then return 'double_four'; end if;
      fours := array_append(fours,shape);
    end loop;

    -- A three must become an open straight four with two exact-five ends.
    -- Deduplicate extensions of the same three, but keep all extension options.
    for start_at in 3..6 loop
      segment := substr(line,start_at,4);
      if segment !~ '^[b.]{4}$' or length(replace(segment,'b',''))<>1 or
         substr(line,start_at-1,1)<>'.' or substr(line,start_at+4,1)<>'.' or
         substr(line,start_at-2,1)='b' or substr(line,start_at+5,1)='b' then continue; end if;
      shape := axis::text || ':' || rpad(lpad(segment,start_at+3,'.'),11,'.');
      if not (shape=any(threes)) then threes := array_append(threes,shape); end if;
      delta := start_at + strpos(segment,'.') - 7;
      candidate_threes := array_append(candidate_threes,shape);
      candidate_rows := array_append(candidate_rows,p_row + row_steps[axis]*delta);
      candidate_cols := array_append(candidate_cols,p_col + col_steps[axis]*delta);
    end loop;
  end loop;
  if cardinality(threes)<2 then return null; end if;

  -- Each recursive check fills one empty cell. A winning or forbidden
  -- extension does not count, even when the visible shape looks open.
  for i in 1..cardinality(candidate_threes) loop
    shape := candidate_threes[i];
    if valid_three=shape then continue; end if;
    r := candidate_rows[i];
    c := candidate_cols[i];
    if private.omok_black_move_result(
      jsonb_set(p_board,array[r::text,c::text],'"black"'::jsonb,false),r,c
    ) is not null then continue; end if;
    if valid_three is not null then return 'double_three'; end if;
    valid_three := shape;
  end loop;
  return null;
end;
$$;

create function private.omok_validate_move(
  p_board jsonb,p_row integer,p_col integer,p_stone text,p_rule_set text
) returns boolean language plpgsql immutable set search_path='' as $$
declare result text;
begin
  if p_stone<>'black' or p_rule_set='freestyle' then
    return private.omok_has_five(p_board,p_row,p_col,p_stone);
  end if;
  result := private.omok_black_move_result(p_board,p_row,p_col);
  if result is null then return false; end if;
  if result='five' then return true; end if;
  raise exception using message='OMOK_FORBIDDEN_' || upper(result);
end;
$$;

revoke all on function private.omok_black_move_result(jsonb,integer,integer) from public,anon,authenticated,service_role;
revoke all on function private.omok_validate_move(jsonb,integer,integer,text,text) from public,anon,authenticated,service_role;

-- Keep existing ACL, row locks, request replay and ranked settlement.
create or replace function public.play_omok_move(
  p_match_id uuid,p_request_id uuid,p_turn integer,p_row integer,p_col integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  game public.omok_matches%rowtype;
  previous public.omok_moves%rowtype;
  stone text;
  next_board jsonb;
  won boolean;
  finished boolean;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into game from public.omok_matches where id=p_match_id for update;
  if not found or actor not in(game.black_id,game.white_id) then
    raise exception 'MATCH_NOT_FOUND'; end if;
  select * into previous from public.omok_moves
    where match_id=p_match_id and request_id=p_request_id;
  if found then
    if previous.player_id<>actor or previous.turn_no<>p_turn or
       previous.row_no<>p_row or previous.col_no<>p_col then
      raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',game.id,'status',game.status,'turnNo',game.turn_no,
      'turnUserId',game.turn_user_id,'winnerId',game.winner_id,'finishReason',game.finish_reason,
      'boardState',game.board_state,'replayed',true);
  end if;
  if game.status<>'active' then raise exception 'MATCH_FINISHED'; end if;
  if game.turn_user_id<>actor or game.turn_no<>p_turn then
    raise exception 'STALE_TURN'; end if;
  if p_row is null or p_col is null or p_row not between 0 and 14 or
      p_col not between 0 and 14 then raise exception 'INVALID_MOVE'; end if;
  if game.board_state #>> array[p_row::text,p_col::text] is not null then
    raise exception 'CELL_OCCUPIED'; end if;
  stone:=case when actor=game.black_id then 'black' else 'white' end;
  next_board:=jsonb_set(game.board_state,array[p_row::text,p_col::text],to_jsonb(stone),false);

  won:=private.omok_validate_move(next_board,p_row,p_col,stone,game.rule_set);
  finished:=won or p_turn=225;
  update public.omok_matches set
    board_state=next_board,
    turn_no=p_turn+1,
    turn_user_id=case when actor=black_id then white_id else black_id end,
    status=case when finished then 'finished' else 'active' end,
    winner_id=case when won then actor else null end,
    finish_reason=case when won then 'five' when finished then 'draw' else null end,
    finished_at=case when finished then now() else null end
  where id=p_match_id;
  insert into public.omok_moves(match_id,turn_no,request_id,player_id,stone,row_no,col_no)
    values(p_match_id,p_turn,p_request_id,actor,stone,p_row,p_col);
  return jsonb_build_object('id',game.id,
    'status',case when finished then 'finished' else 'active' end,
    'turnNo',p_turn+1,
    'turnUserId',case when actor=game.black_id then game.white_id else game.black_id end,
    'winnerId',case when won then actor else null end,
    'finishReason',case when won then 'five' when finished then 'draw' else null end,
    'boardState',next_board,'replayed',false);
end;
$$;

create or replace function public.commit_omok_ai_turn(
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
  human_win:=private.omok_validate_move(board,p_human_row,p_human_col,'black',game.rule_set);
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

commit;
