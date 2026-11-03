\set ON_ERROR_STOP on
-- This script runs immediately after omok-pg17-full-stack.sql on the same
-- disposable Postgres 17 service; it never uses remote Supabase credentials.
\echo 'AI: authenticate owner, commit a human+bot turn and replay once'
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_ai_match('normal') as ai_match \gset
reset role;

set role service_role;
select public.commit_omok_ai_turn(
  m.id, '11111111-1111-4111-8111-111111111111'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000011'::uuid,1,m.board_state,
  7,7,7,8
) as first_turn from public.omok_ai_matches m where m.id=:'ai_match'::uuid;
do $ai$
declare a public.omok_ai_matches%rowtype; replay jsonb; unauthorized boolean:=false;
begin
  select * into strict a from public.omok_ai_matches where id=(
    select id from public.omok_ai_matches where owner_id=
      '11111111-1111-4111-8111-111111111111'::uuid and status='active'
    order by created_at desc limit 1);
  if a.turn_no<>2 or a.board_state #>> '{7,7}'<>'black'
     or a.board_state #>> '{7,8}'<>'white' then
    raise exception 'AI_TURN_NOT_COMMITTED';
  end if;
  -- Same request is idempotent even though the current board is newer.
  select public.commit_omok_ai_turn(
    a.id,'11111111-1111-4111-8111-111111111111'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-000000000011'::uuid,1,
    'null'::jsonb,7,7,7,8) into replay;
  if replay->>'replayed'<>'true' then raise exception 'AI_REPLAY_NOT_IDEMPOTENT'; end if;
  begin
    perform public.forfeit_omok_ai_match(a.id,'33333333-3333-4333-8333-333333333333'::uuid);
  exception when others then
    if sqlerrm='MATCH_NOT_FOUND' then unauthorized:=true;
    else raise; end if;
  end;
  if not unauthorized then raise exception 'AI_FORFEIT_IDOR'; end if;
end;
$ai$;
reset role;
-- Only authenticated clients can create AI matches; settlement is service-only.
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $ai_acl$
declare blocked boolean:=false;
begin
 begin
   perform public.commit_omok_ai_turn(
      '00000000-0000-4000-8000-000000000001'::uuid,
      auth.uid(), 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'::uuid,
      1,'[]'::jsonb,0,0,0,1);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'AI_SETTLEMENT_RPC_EXPOSED'; end if;
end;
$ai_acl$;
reset role;
set role service_role;
select public.forfeit_omok_ai_match(
  :'ai_match'::uuid,'11111111-1111-4111-8111-111111111111'::uuid);
reset role;

do $ai_xp$
begin
 if (select count(*) from public.omok_ai_turns where match_id=:'ai_match'::uuid)<>1
   then raise exception 'AI_TURN_LOG_DUPLICATED'; end if;
 if (select count(*) from public.xp_events
     where source_kind='omok_ai' and source_id=:'ai_match'::uuid)<>1
   then raise exception 'AI_XP_DUPLICATE_OR_MISSING'; end if;
 if (select status from public.omok_ai_matches where id=:'ai_match'::uuid)<>'finished'
    then raise exception 'AI_FORFEIT_NOT_FINAL'; end if;
 raise notice 'PASS: AI turn, replay, service RPC scope, owner and XP';
end;
$ai_xp$;

\echo 'Social: accepted friendship, invited room, exactly-once acceptance'
insert into public.friend_links(requester_id,recipient_id,status)
values('11111111-1111-4111-8111-111111111111',
       '22222222-2222-4222-8222-222222222222','accepted');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_room('JKLMNPQR') as friend_room \gset
select public.send_omok_friend_invite(
  :'friend_room'::uuid,'22222222-2222-4222-8222-222222222222'::uuid);
select public.send_omok_friend_invite(
  :'friend_room'::uuid,'22222222-2222-4222-8222-222222222222'::uuid);
reset role;

set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $invite_outsider$
declare denied boolean:=false;
begin
 begin
  perform public.list_omok_received_invites();
  -- No invites are expected for user 3, even if other accounts have pending.
  if jsonb_array_length(public.list_omok_received_invites())<>0
    then raise exception 'INVITE_DATA_LEAK'; end if;
  perform public.respond_omok_friend_invite(
    (select id from public.omok_friend_invites limit 1),true);
 exception when insufficient_privilege then
  -- Authenticated cannot select the private table; this is the desired boundary.
  denied:=true;
 end;
 if not denied then raise exception 'INVITE_PRIVATE_TABLE_EXPOSED'; end if;
end;
$invite_outsider$;
reset role;

set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.list_omok_received_invites();
-- The private table is read by the test owner (not this authenticated role);
-- use the ID returned from sender RPC via an authorized receiver listing.
select (elem->>'id')::uuid as received_invite
  from jsonb_array_elements(public.list_omok_received_invites()) elem
  where (elem->>'roomId')::uuid=:'friend_room'::uuid
  limit 1 \gset
select public.respond_omok_friend_invite(:'received_invite'::uuid,true);
do $double_accept$
declare denied boolean:=false;
begin
 begin
  perform public.respond_omok_friend_invite(
    (select (e->>'id')::uuid from jsonb_array_elements(
      public.list_omok_received_invites()) e limit 1),true);
 exception when others then denied:=true; end;
 -- Second request cannot create extra seat even when duplicate UI events race.
 if (select count(*) from public.omok_room_players
   where user_id=auth.uid())>3 then raise exception 'EXCESS_SEATS'; end if;
end;
$double_accept$;
reset role;

do $invite_checks$
declare r uuid;
begin
 select id into strict r from public.omok_rooms where code='JKLMNPQR';
 if (select count(*) from public.omok_room_players where room_id=r)<>2 or
    (select count(*) from public.omok_friend_invites where room_id=r)<>1 or
    (select status from public.omok_friend_invites where room_id=r)<>'accepted'
 then raise exception 'INVITE_ACCEPTANCE_NOT_ATOMIC'; end if;
 raise notice 'PASS: friendship and private invitation / room capacity';
end;
$invite_checks$;

-- A block must prevent inviting even if a friendship row remains accepted.
insert into public.friend_links(requester_id,recipient_id,status)
values('11111111-1111-4111-8111-111111111111',
       '33333333-3333-4333-8333-333333333333','accepted');
insert into public.player_blocks(blocker_id,blocked_id)
values('33333333-3333-4333-8333-333333333333',
       '11111111-1111-4111-8111-111111111111');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.create_omok_room('QRSTUVWX') as blocked_room \gset
do $blocked$
declare r uuid; rejected boolean:=false;
begin
 select id into strict r from public.omok_rooms where code='QRSTUVWX';
 begin
  perform public.send_omok_friend_invite(
    r,'33333333-3333-4333-8333-333333333333'::uuid);
 exception when others then
  if sqlerrm='FRIEND_NOT_AVAILABLE' then rejected:=true;
  else raise; end if;
 end;
 if not rejected then raise exception 'BLOCKED_FRIEND_INVITE_ALLOWED'; end if;
end;
$blocked$;
reset role;

\echo 'Ranked: queue pairing, independent Elo and once-only XP settlement'
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.join_omok_ranked_queue();
reset role;
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.join_omok_ranked_queue();
reset role;
do $rank_queue$
declare m public.omok_matches%rowtype;
begin
 select * into strict m from public.omok_matches where mode='ranked'
  and status='active' order by created_at desc limit 1;
 if m.black_id=m.white_id
   or m.turn_user_id<>m.black_id
   or m.turn_deadline is null
   or (select count(*) from public.omok_ranked_queue
      where user_id in(m.black_id,m.white_id))<>0 then
   raise exception 'RANKED_PAIRING_FAILED'; end if;
 raise notice 'PASS: ranked paired two users, deadline and empty queue';
end;
$rank_queue$;

set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $rank_outsider$
begin
 if exists(select 1 from public.omok_matches where mode='ranked') or
    exists(select 1 from public.omok_rating_history) then
   raise exception 'RANKED_DATA_LEAK'; end if;
end;
$rank_outsider$;
reset role;
-- Forfeit the ranked black player; white wins, Elo and XP settle in triggers.
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $rank_forfeit$
declare m public.omok_matches%rowtype;
begin
 select * into strict m from public.omok_matches where mode='ranked'
  and status='active';
 perform public.forfeit_omok_match(m.id);
end;
$rank_forfeit$;
reset role;
do $rank_result$
declare m public.omok_matches%rowtype;
begin
 select * into strict m from public.omok_matches where mode='ranked'
   and status='finished';
 if m.finish_reason<>'forfeit'
   or (select count(*) from public.omok_rating_history where match_id=m.id)<>2
   or (select count(*) from public.xp_events where source_kind='omok_ranked'
      and source_id=m.id)<>2
   or (select count(*) from public.omok_ratings
      where user_id in(m.black_id,m.white_id)
        and (rating=1000 or wins+losses+draws<>1))<>0 then
   raise exception 'RANKED_SETTLEMENT_NOT_ATOMIC'; end if;
 if exists(select 1 from public.profiles where
   id in(m.black_id,m.white_id) and rating<>1000)
 then raise exception 'ALKkAGI_RATING_MUTATED'; end if;
 raise notice 'PASS: ranked Elo/history/XP and Alkkagi rating isolation';
end;
$rank_result$;
