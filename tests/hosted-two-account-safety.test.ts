import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('src/app/qa/two-account/page.tsx');
const view=read('src/components/qa/two-account-qa.tsx');
const guards=read('src/lib/qa/two-account-guards.ts');
const proxy=read('src/proxy.ts');
const docs=read('docs/hosted-two-account-e2e.md');

describe('browser-only production A/B QA safe integration (#196)',()=>{
  it('is disabled by default and pins validated server A/B role and target',()=>{
    expect(page).toContain("process.env.OPS_TWO_ACCOUNT_QA_ENABLED!=='true'");
    expect(page).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://igjvccohxthmgbfilzxi.supabase.co'");
    expect(page.indexOf('notFound()')).toBeLessThan(page.indexOf('await requireUser()'));
    expect(page).toContain('resolveQaPair(process.env.OPS_TWO_ACCOUNT_QA_USER_IDS,user.id)');
    expect(page).toContain('if(!pair)notFound()');
    expect(page).toContain('userId={user.id} pair={pair}');
    expect(guards).toContain('allowed.length!==2');
    expect(view).toContain('const peer=pair.otherUserId');
    expect(view).toContain('const role=pair.role');
    expect(view).toContain('qaPeerAllowed(userId,peer,pair)');
    expect(view).not.toContain('setPeer(');
    expect(view).not.toContain('setRole(');
    expect(page).toContain('index:false');
    expect(proxy).toContain("'/qa/:path*'");
    // Production must also send a noindex HTTP header, not just HTML metadata.
    expect(read('next.config.ts')).toContain('"/qa/:path*"');
  });

  it('uses real SSR Auth session, same-origin APIs and no privileged database mutation',()=>{
    expect(view).toContain("credentials:'same-origin'");
    expect(view).toContain('db.auth.getUser()');
    expect(view).toContain('data.user?.id.toLowerCase()!==userId.toLowerCase()');
    for(const target of [page,view,guards]){
      expect(target).not.toContain('SERVICE_ROLE_KEY');
      expect(target).not.toContain('SUPABASE_SECRET_KEY');
      expect(target).not.toContain('auth.admin.');
      expect(target).not.toContain('signInWithPassword(');
      expect(target).not.toContain('signUp(');
      expect(target).not.toContain('apply_migration');
    }
    expect(view).not.toContain('.delete(');
    expect(view).not.toContain(".from('matches').update(");
    expect(view).not.toContain(".from('xp_events').insert(");
  });

  it('requires operator opt-in, a real XP snapshot and manual click before every write',()=>{
    expect(view).toContain('const [approved,setApproved]=useState(false)');
    expect(view).toContain('if(writes&&!approved)');
    expect(view).toContain('if(writes&&!snapshot)');
    expect(view).toContain('inFlight.current=true');
    expect(view).toContain('disabled={busy||disabled||(write&&!approved)||!snapshot&&write}');
    expect(view).toContain('<input type="checkbox" checked={approved}');
    for(const action of ['sendFriend,true','acceptFriend,true','sendMessage,true',
      'inviteFriend,true','acceptInvite,true','checkCosmetics,true']){
      expect(view).toContain(action);
    }
    expect([...view.matchAll(/useEffect\(\(\)=>/g)]).toHaveLength(1);
    expect(view).toContain('realtime.current?.cleanup()');
  });

  it('uses B JWT Realtime event ID, deterministic one-shot DM and read-before-invite',()=>{
    expect(view).toContain('db.realtime.setAuth(data.session.access_token)');
    expect(view).toContain("'postgres_changes'");
    expect(view).toContain("event:'INSERT'");
    expect(view).toContain("table:'dm_messages'");
    expect(view).toContain('events.some(e=>e.id===checkId&&e.body===checkMarker)');
    expect(view).toContain('history.messages.some(e=>e.id===checkId&&e.body===checkMarker)');
    expect(view).toContain('await qaDmIdentity(pair.userA,pair.userB)');
    expect(view).toContain('if(sent.alreadySent)');
    expect(view).toContain("'/api/room-invites/sent?roomId='");
    expect(view).toContain('qaCanSendInvite(sent,peer)');
    expect(view).toContain('qaCanSendDm(history.messages,marker)');
    expect(view).toContain('REALTIME_INSERT_NOT_OBSERVED');
  });

  it('validates exact A/B room, match, UTC cap, XP baseline, unique reward',()=>{
    expect(view).toContain("db.rpc('get_casual_room',{p_room_id:roomId})");
    expect(view).toContain('qaScopeRpcRoom(info.room,info.rpc,pair,snapshot,userId,1)');
    expect(view).toContain('qaScopeRpcRoom(info.room,info.rpc,pair,snapshot,userId,2)');
    expect(view).toContain('qaScopeMatch(match as QaMatch|null,info.room,info.rpc,pair,snapshot,userId)');
    expect(view).not.toContain("db.from('room_players')");
    expect(guards).toContain('rpc.yourSeat');
    expect(guards).toContain('rpc.players.length!==expectedSeats');
    expect(view).toContain('qaDailyCounts(userId,peer,now)');
    expect(view).toContain('UTC_DAY_CHANGED_BASELINE_EXPIRED');
    expect(view).toContain("base().in('source_kind',['casual','ranked'])");
    expect(view).toContain("base().eq('source_kind','casual').eq('opponent_id',peerId)");
    expect(view).toContain("rewards?.length!==1");
    expect(view).toContain('qaReward(snapshot,');
    expect(view).toContain('current.totalXp!==snapshot.totalXp+gained');
    expect(view).toContain('LIMITED:');
    expect(guards).toContain('snapshot.dailyPvp>=20||snapshot.dailyCasualPeer>=5');
  });

  it('does not persist sensitive data or claim real E2E based only on CI',()=>{
    expect(view).not.toContain('console.log');
    expect(view).not.toContain('localStorage');
    expect(view).not.toContain('sessionStorage');
    expect(view).not.toContain('JSON.stringify(error)');
    expect(docs).toContain('OPS_TWO_ACCOUNT_QA_ENABLED');
    expect(docs).toContain('별도 승인');
    expect(docs).toContain('20');
  });
});
