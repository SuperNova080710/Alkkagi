/**
 * Local Supabase E2E. ONLY run against the disposable Docker stack on loopback.
 * Real Auth tokens, PostgREST RLS and Realtime WebSocket are used; no stubs.
 * Never log account emails, tokens, API keys or service-role credentials.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

function requireLocalApi(urlValue) {
  const url = new URL(urlValue || '');
  assert.equal(url.protocol, 'http:', 'E2E requires local, non-TLS Supabase API');
  assert.equal(url.hostname, '127.0.0.1', 'Refusing any non-loopback Supabase host');
  assert.equal(url.port, '54321', 'Refusing any non-default local Supabase API port');
  assert.equal(url.pathname, '/', 'Refusing path-prefixed or remote Supabase API');
  assert.equal(url.username, '', 'Refusing URL credentials');
  assert.equal(url.password, '', 'Refusing URL credentials');
  return url.origin;
}
function assertLocalDatabase(urlValue) {
  const url = new URL(urlValue || '');
  assert.equal(url.protocol, 'postgresql:', 'Refusing unexpected DB scheme');
  assert.equal(url.hostname, '127.0.0.1', 'Refusing remote PostgreSQL');
  assert.equal(url.port, '54322', 'Refusing non-local PostgreSQL port');
  assert.equal(url.pathname, '/postgres', 'Refusing non-test database');
}
function requireData(response,step) {
  // An upstream error message may include request details. Never print it in
  // GitHub Actions logs; only emit a bounded, non-secret error code.
  if (response.error) {
    const code=String(response.error.code || 'UNKNOWN').replace(/[^A-Za-z0-9_]/g,'').slice(0,40);
    throw Error(step+' failed ('+(code || 'UNKNOWN')+')');
  }
  assert.notEqual(response.data,null,step+' returned empty data');
  return response.data;
}
function rejected(response,step) {
  assert.ok(response.error,step+' unexpectedly succeeded');
}
async function bounded(promise,timeoutMs,label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error(label+' timed out after '+timeoutMs+'ms')),timeoutMs);
      }),
    ]);
  } finally {clearTimeout(timer);}
}
async function run() {
  // Check the *database* endpoint before even creating the service-role client.
  const url=requireLocalApi(process.env.API_URL);
  assertLocalDatabase(process.env.DB_URL);
  const anon=process.env.ANON_KEY;
  const service=process.env.SERVICE_ROLE_KEY;
  assert.ok(anon?.length>50 && service?.length>50,'Local keys are missing');
  const clientOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const guest=createClient(url,anon,clientOptions);
  const a=createClient(url,anon,clientOptions);
  const b=createClient(url,anon,clientOptions);
  const privileged=createClient(url,service,clientOptions);
  const suffix=randomUUID().slice(0,10);
  const password='E2e-Only-Local-'+randomUUID()+'!';
  let channel;
  try {
    async function register(client,label){
      const result=await bounded(client.auth.signUp({
        email:'alkkagi-e2e-'+label+'-'+suffix+'@example.com',
        password,
      }),10000,'GoTrue signup '+label);
      if (result.error) throw Error('GoTrue signup '+label+' failed');
      assert.ok(result.data.user?.id,'Missing registered identity');
      assert.ok(result.data.session?.access_token,'Local Auth must return a JWT session');
      return result.data.user.id;
    }
    const userA=await register(a,'a');
    const userB=await register(b,'b');
    assert.notEqual(userA,userB);
    console.log('PASS Auth: two independent GoTrue signups and JWT sessions');

    const self= requireData(await a.from('profiles').select('id').eq('id',userA),'profile own');
    assert.equal(self.length,1);
    const other= requireData(await b.from('profiles').select('id').eq('id',userA),'profile cross-user');
    assert.equal(other.length,0,'Private profile visible to another authenticated account');
    rejected(await guest.rpc('get_friend_overview'),'anon protected RPC');
    rejected(await a.from('friend_links').insert({
      requester_id:userA,recipient_id:userB,status:'accepted',
    }),'authenticated table write');
    console.log('PASS RLS: JWT owner read, cross-account read and direct write rejected');

    const sent=requireData(await a.rpc('send_friend_request',{p_target:userB}),'friend request');
    assert.ok(sent.requestId,'Missing friend request ID');
    const accepted=requireData(await b.rpc('respond_friend_request',{
      p_request_id:sent.requestId,p_accept:true,
    }),'friend accept');
    assert.equal(accepted.status,'accepted');
    console.log('PASS Friends: authenticated A -> B friend request / B acceptance');

    // Subscribe *before* the message write. The Realtime backend must enforce
    // per-subscriber RLS using B's JWT, not the service-role token.
    const sessionB=await b.auth.getSession();
    assert.ok(sessionB.data.session?.access_token);
    b.realtime.setAuth(sessionB.data.session.access_token);
    // SUBSCRIBED confirms channel join, not that the logical replication
    // stream is ready. Observe real JWT/RLS-filtered database events instead
    // of depending on a fixed delay after SUBSCRIBED.
    const seenBodies=new Map();
    const waitingForBody=new Map();
    let eventsSeen=0;
    let readyResolve,readyReject;
    const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
    channel=b.channel('alkkagi-e2e-'+suffix)
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'dm_messages',
      },(event)=>{
        eventsSeen++;
        if(event.new?.sender_id!==userA || typeof event.new?.body!=='string') return;
        seenBodies.set(event.new.body,event.new);
        waitingForBody.get(event.new.body)?.(event.new);
      })
      .subscribe((status)=>{
        if(status==='SUBSCRIBED')readyResolve();
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')
          readyReject(Error('Realtime channel '+status));
      });
    await bounded(ready,25000,'Realtime subscription');

    async function waitForBody(body,timeoutMs){
      if(seenBodies.has(body)) return seenBodies.get(body);
      let resolveBody;
      const notification=new Promise((resolve)=>{resolveBody=resolve;});
      waitingForBody.set(body,resolveBody);
      try {
        return await bounded(notification,timeoutMs,'Realtime RLS-filtered DM INSERT');
      } finally {
        waitingForBody.delete(body);
      }
    }

    // Each attempt is a real, unique, local-only DM sent through the public
    // RPC. A retry cannot invent an event or bypass B's JWT/SELECT RLS.
    // Waiting 3s between writes also respects the 1s server DM rate limit.
    let message, msg, delivered;
    for(let attempt=0;attempt<5;attempt++){
      message='E2E-DM-'+suffix+'-'+attempt;
      msg=requireData(await a.rpc('send_direct_message',{
        p_peer:userB,p_body:message,p_request_id:randomUUID(),
      }),'DM send');
      assert.equal(msg.body,message);
      try {
        delivered=await waitForBody(message,3000);
        break;
      } catch (error) {
        if(attempt===4) {
          throw Error('Realtime INSERT not observed after 5 messages; events seen='+eventsSeen);
        }
        // Only a bounded missing-event timeout is retried. Other checks,
        // including the RPC, must succeed independently.
        if(!String(error.message).includes('timed out')) throw error;
      }
    }
    assert.ok(delivered,'Expected JWT-authorized Realtime INSERT');
    assert.equal(String(delivered.id),String(msg.id),'WebSocket row must match the RPC response');
    const history=requireData(await b.rpc('get_direct_messages',{
      p_peer:userA,p_before_id:null,p_limit:20,
    }),'DM read');
    assert.ok(history.messages.some((m)=>m.id===String(msg.id) && m.body===message));
    console.log('PASS DM + Realtime: friend-only message delivered over B authenticated WebSocket');

    const room=requireData(await a.rpc('create_casual_room',{
      p_code:'A'+suffix.slice(0,7).toUpperCase().replaceAll('0','2').replaceAll('1','3'),
    }),'casual room create');
    assert.ok(room);
    const invite=requireData(await a.rpc('send_room_friend_invite',{
      p_room_id:room,p_target_id:userB,
    }),'friend room invite');
    assert.ok(invite.inviteId);
    const inviteAccepted=requireData(await b.rpc('respond_room_friend_invite',{
      p_invite_id:invite.inviteId,p_accept:true,
    }),'room invite accepted');
    assert.equal(inviteAccepted.roomId,room);
    const roomRead=requireData(await b.rpc('get_casual_room',{p_room_id:room}),'B room membership');
    assert.equal(roomRead.yourSeat,2);
    console.log('PASS Invites: host invites friend and B gets the second room seat');

    // Local service-role is used *only* for deterministic synthetic game
    // completion. No XP is submitted by any client.
    for(let i=0;i<2;i++){
      const created=requireData(await privileged.from('matches').insert({
        mode:'ranked',player1_id:userA,player2_id:userB,
        turn_user_id:userA,board_state:{},
      }).select('id').single(),'synthetic ranked match');
      requireData(await privileged.from('matches').update({
        status:'finished',winner_id:userA,finished_at:new Date().toISOString(),
      }).eq('id',created.id).select('id').single(),'finish ranked match');
    }
    const xp=requireData(await a.rpc('get_player_experience',{p_player_id:userA}),'XP self');
    assert.equal(xp.totalXp,140);
    assert.equal(xp.level,2);
    const rivalXp=requireData(await b.rpc('get_player_experience',{p_player_id:userB}),'XP B');
    assert.equal(rivalXp.totalXp,70);
    const ownItems=requireData(await a.rpc('get_my_cosmetics'),'cosmetics');
    assert.equal(ownItems.level,2);
    assert.ok(ownItems.items.some(x=>x.code==='avatar-orbit'&&x.owned===true));
    const equipped=requireData(await a.rpc('equip_my_cosmetic',{p_item_code:'avatar-orbit'}),'equip');
    assert.equal(equipped.avatarCode,'avatar-orbit');
    const otherInventory=requireData(await b.from('player_cosmetic_inventory')
      .select('item_code').eq('user_id',userA),'cross-user inventory');
    assert.equal(otherInventory.length,0);
    console.log('PASS Game/XP/Cosmetics: unique game settlement, level 2 unlock, cross-user RLS');

    requireData(await b.rpc('set_player_block',{p_target:userA,p_block:true}),'B blocks A');
    rejected(await a.rpc('send_direct_message',{
      p_peer:userB,p_body:'blocked message',p_request_id:randomUUID(),
    }),'blocked DM');
    console.log('PASS Block: messaging rejected immediately after friend block');
  } finally {
    if(channel)await b.removeChannel(channel);
    for(const client of [a,b,guest,privileged])await client.removeAllChannels();
    // Test users live only inside the runner's disposable local DB, which the
    // workflow deletes with supabase stop --no-backup.
  }
}
await bounded(run(),125000,'Complete local Supabase E2E');
console.log('PASS LOCAL SUPABASE E2E: Auth / RLS / Friends / DM Realtime / Invite / XP / Cosmetics');
