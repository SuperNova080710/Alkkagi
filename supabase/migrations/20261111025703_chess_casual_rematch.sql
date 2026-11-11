begin;

create table public.chess_rematches (
  match_id uuid primary key references public.chess_matches(id) on delete cascade,
  white_voted boolean not null,
  black_voted boolean not null,
  next_match_id uuid unique references public.chess_matches(id),
  check (white_voted or black_voted),
  check ((next_match_id is not null) = (white_voted and black_voted)),
  check (next_match_id <> match_id)
);

alter table public.chess_rematches enable row level security;
revoke all on public.chess_rematches from public,anon,authenticated,service_role;
grant select on public.chess_rematches to authenticated;
grant select,insert,update on public.chess_rematches to service_role;
create policy chess_rematches_participants on public.chess_rematches for select to authenticated
  using (exists (
    select 1 from public.chess_matches m where m.id=chess_rematches.match_id
      and m.mode='casual' and (select auth.uid()) in (m.white_id,m.black_id)
  ));

create or replace function public.chess_match_snapshot(p_match_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('match',to_jsonb(m),'moves',coalesce((
    select jsonb_agg(to_jsonb(t) order by t.ply) from public.chess_moves t where t.match_id=m.id
  ),'[]'::jsonb),'rematch',case
    when m.mode='casual' and m.finished_at>statement_timestamp()-interval '30 minutes'
    then jsonb_build_object('whiteVoted',coalesce(r.white_voted,false),
      'blackVoted',coalesce(r.black_voted,false),'nextMatchId',r.next_match_id)
  end)
  from public.chess_matches m left join public.chess_rematches r on r.match_id=m.id
  where m.id=p_match_id and (select auth.uid()) in (m.white_id,m.black_id)
$$;

create function public.chess_vote_rematch(p_actor uuid,p_match_id uuid,p_code text)
returns void language plpgsql set search_path='' as $$
declare
  game public.chess_matches%rowtype;
  ballot public.chess_rematches%rowtype;
  next_room_id uuid;
  successor_id uuid;
begin
  -- One previous match can produce one successor, even when both votes arrive together.
  select * into game from public.chess_matches where id=p_match_id for update;
  if not found or p_actor is null or p_actor not in (game.white_id,game.black_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  if game.mode<>'casual' or game.finished_at is null then
    raise exception 'REMATCH_NOT_AVAILABLE';
  end if;
  if game.finished_at<=clock_timestamp()-interval '30 minutes' then
    raise exception 'REMATCH_EXPIRED';
  end if;

  select * into ballot from public.chess_rematches where match_id=game.id;
  if (p_actor=game.white_id and ballot.white_voted) or (p_actor=game.black_id and ballot.black_voted) then
    return;
  end if;
  if ballot.match_id is null then
    insert into public.chess_rematches(match_id,white_voted,black_voted)
      values(game.id,p_actor=game.white_id,p_actor=game.black_id);
    return;
  end if;

  -- Create a new room already occupied by the same players, with colors reversed.
  insert into public.chess_rooms(code,host_id,guest_id,create_request_id)
    values(p_code,game.black_id,game.white_id,gen_random_uuid())
    on conflict(code) do nothing returning id into next_room_id;
  if not found then raise exception 'ROOM_CODE_CONFLICT'; end if;
  successor_id:=public.chess_start_match(game.black_id,next_room_id);
  update public.chess_rematches set white_voted=true,black_voted=true,next_match_id=successor_id
    where match_id=game.id;
end;
$$;
revoke all on function public.chess_vote_rematch(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.chess_vote_rematch(uuid,uuid,text) to service_role;

alter publication supabase_realtime add table public.chess_rematches;

commit;
