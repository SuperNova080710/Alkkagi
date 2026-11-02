/**
 * Hosted Alkkagi two-account E2E, opt-in only.
 *
 * NEVER pass service_role, secret keys, database credentials or privileged SQL.
 * Real GoTrue user sessions and PostgREST/RLS/Realtime are the only actors.
 * "prepare" writes the explicitly approved friend/DM/room/invite/cosmetics
 * fixtures; "verify" reads the result of a human-played casual game.
 *
 * All credentials are read only from the operator's local TTY, not process
 * arguments, CI, environment variables or persisted state.
 */
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';

export const PROJECT_HOST='https://igjvccohxthmgbfilzxi.supabase.co';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const timeoutMs=30000;

export function requirePublishableConfig(url,key) {
  assert.equal(url,PROJECT_HOST,'Refusing unexpected Supabase project');
  assert.ok(typeof key==='string' && key.length>20,'Publishable key required');
  assert.ok(key.startsWith('sb_publishable_') ||
    (key.split('.').length===3 && !key.startsWith('sb_secret_')),
  'Only publishable / legacy anon key accepted');
  assert.ok(!key.startsWith('sb_secret_'),'Service secret is forbidden');
  // JWT-style keys are legacy: a local pub/anon key must not claim service_role.
  if(key.split('.').length===3) {
    const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));
    assert.equal(payload.role,'anon','Refusing a privileged JWT');
  }
  return {url,key};
}

export function safeError(error,label) {
  const code=String(error?.code||error?.status||'UNKNOWN')
    .replace(/[^A-Za-z0-9_]/g,'').slice(0,32);
  return new Error(label+' failed ['+code+']');
}

function data(result,label) {
  if(result.error) throw safeError(result.error,label);
  assert.notEqual(result.data,null,label+' returned empty data');
  return result.data;
}
async function bounded(promise,ms,label) {
  let timer;
  try { return await Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' TIMEOUT')),ms);}),
  ]); } finally {clearTimeout(timer);}
}
function hiddenInput(prompt) {
  if(!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('Run interactively in your own Ubuntu terminal (TTY required).');
  return new Promise((resolveInput,rejectInput)=>{
    const input=process.stdin;
    const originalRaw=Boolean(input.isRaw);
    let value='';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const finish=(error)=>{
      input.off('data',onData);
      input.setRawMode(originalRaw);
      input.pause();
      process.stdout.write('\n');
      if(error)rejectInput(error);else resolveInput(value);
    };
    function onData(buffer) {
      for(const ch of buffer.toString('utf8')) {
        if(ch==='\r'||ch==='\n') {finish();return;}
        if(ch==='\u0003') {finish(new Error('Cancelled'));return;}
        if(ch==='\u007f'||ch==='\b') {value=value.slice(0,-1);continue;}
        if(ch>=' ' && value.length<512)value+=ch;
      }
    }
    input.on('data',onData);
  });
}

async function sessions(url,key) {
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const guest=createClient(url,key,options);
  const a=createClient(url,key,options);
  const b=createClient(url,key,options);
  async function login(client,label) {
    const email=await hiddenInput('Account '+label+' email (hidden): ');
    const password=await hiddenInput('Account '+label+' password (hidden): ');
    try {
      const auth=await bounded(client.auth.signInWithPassword({email,password}),timeoutMs,'Login '+label);
      if(auth.error || !auth.data.session?.access_token)throw new Error('Login '+label+' failed');
      const checked=await bounded(client.auth.getUser(),timeoutMs,'Verified user '+label);
      if(checked.error || !checked.data.user?.id)throw new Error('Auth '+label+' not verified');
      return checked.data.user.id;
    } finally { /* Never save credentials, URLs containing tokens or sessions. */ }
  }
  const userA=await login(a,'A');
  const userB=await login(b,'B');
  assert.notEqual(userA,userB,'Two distinct user accounts required');
  return {a,b,guest,userA,userB};
}
async function ownRls(s) {
  const own=data(await s.a.from('profiles').select('id').eq('id',s.userA),'A profile');
  assert.equal(own.length,1);
  const denied=data(await s.b.from('profiles').select('id').eq('id',s.userA),'B reads A profile');
  assert.equal(denied.length,0,'B must not read A private profile');
  const anonymous=await s.guest.rpc('get_friend_overview');
  assert.ok(anonymous.error,'Anonymous friend RPC unexpectedly succeeded');
  const privateItems=data(await s.b.from('player_cosmetic_inventory')
    .select('item_code').eq('user_id',s.userA),'B reads A inventory');
  assert.equal(privateItems.length,0,'Private inventory leaked');
  console.log('PASS: real Auth A/B, anonymous RPC denied, profile and inventory RLS');
}
async function ensureFriends(s) {
  const overview=data(await s.a.rpc('get_friend_overview'),'A friends');
  if(overview.friends.some(x=>x.id===s.userB)) {
    console.log('PASS: A/B already accepted friends');
    return;
  }
  const incoming=overview.incoming.find(x=>x.userId===s.userB);
  if(incoming) {
    const r=data(await s.a.rpc('respond_friend_request',{p_request_id:incoming.id,p_accept:true}),
      'A accepts existing friend request');
    assert.equal(r.status,'accepted');
  } else {
    const outgoing=overview.outgoing.find(x=>x.userId===s.userB);
    const id=outgoing?.id??data(await s.a.rpc('send_friend_request',{p_target:s.userB}),
      'A sends friend request').requestId;
    const r=data(await s.b.rpc('respond_friend_request',{p_request_id:id,p_accept:true}),
      'B accepts friend request');
    assert.equal(r.status,'accepted');
  }
  const bView=data(await s.b.rpc('get_friend_overview'),'B friend overview');
  assert.ok(bView.friends.some(x=>x.id===s.userA));
  console.log('PASS: friend request/acceptance and both JWT-based friend views');
}
async function realtimeDm(s,tag) {
  const token=(await s.b.auth.getSession()).data.session?.access_token;
  assert.ok(token,'B user JWT absent');
  s.b.realtime.setAuth(token);
  const events=new Map();
  let readyOk,readyFail;
  const ready=new Promise((resolveReady,rejectReady)=>{
    readyOk=resolveReady;
    readyFail=rejectReady;
  });
  const channel=s.b.channel('alkkagi-hosted-e2e-'+tag)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages'},e=>{
      if(e.new?.sender_id===s.userA && typeof e.new?.body==='string')
        events.set(e.new.body,String(e.new.id));
    }).subscribe(status=>{
      if(status==='SUBSCRIBED')readyOk();
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))
        readyFail(new Error('Realtime channel did not subscribe: '+status));
    });
  try {
    await bounded(ready,20000,'B Realtime subscription');
    for(let i=0;i<3;i++) {
      const body='HOSTED-E2E-'+tag+'-'+i;
      const sent=data(await s.a.rpc('send_direct_message',{
        p_peer:s.userB,p_body:body,p_request_id:randomUUID(),
      }), 'A sends DM');
      assert.equal(sent.body,body);
      const until=Date.now()+6500;
      while(Date.now()<until && events.get(body)!==String(sent.id))
        await new Promise(done=>setTimeout(done,250));
      if(events.get(body)===String(sent.id)) {
        const inbox=data(await s.b.rpc('get_direct_messages',{
          p_peer:s.userA,p_before_id:null,p_limit:20,
        }),'B reads DM');
        assert.ok(inbox.messages.some(x=>String(x.id)===String(sent.id)));
        console.log('PASS: B JWT Realtime INSERT ID equals DM RPC and history ID; attempts='+(i+1));
        return i+1;
      }
    }
    throw new Error('REALTIME_NOT_DELIVERED: REST success is not a pass');
  } finally {
    await s.b.removeChannel(channel).catch(()=>{});
  }
}
function roomCode() {
  return Array.from(randomBytes(8),n=>alphabet[n%alphabet.length]).join('');
}
function privateStateFile(runId,state) {
  const folder=join(homedir(),'alkkagi-private-e2e');
  mkdirSync(folder,{recursive:true,mode:0o700});
  const file=join(folder,runId+'.json');
  writeFileSync(file,JSON.stringify(state,null,2)+'\n',{mode:0o600,flag:'wx'});
  return file;
}
async function prepare(s) {
  await ownRls(s);
  const beforeA=data(await s.a.rpc('get_player_experience',{p_player_id:s.userA}),'A XP before');
  const beforeB=data(await s.b.rpc('get_player_experience',{p_player_id:s.userB}),'B XP before');
  await ensureFriends(s);
  const tag=randomUUID().slice(0,10);
  const dmCount=await realtimeDm(s,tag);

  const code=roomCode();
  const roomId=data(await s.a.rpc('create_casual_room',{p_code:code}),'Create one casual room');
  const invite=data(await s.a.rpc('send_room_friend_invite',{
    p_room_id:roomId,p_target_id:s.userB,
  }),'Invite B');
  const inbox=data(await s.b.rpc('list_received_room_invites'),'B invite inbox');
  assert.ok(inbox.some(x=>x.id===invite.inviteId));
  const joined=data(await s.b.rpc('respond_room_friend_invite',{
    p_invite_id:invite.inviteId,p_accept:true,
  }),'B joins room');
  assert.equal(joined.status,'accepted');
  assert.equal(joined.roomId,roomId);
  const read=data(await s.b.rpc('get_casual_room',{p_room_id:roomId}),'B room read');
  assert.equal(read.yourSeat,2);
  console.log('PASS: real JWT friend invite and guest seat 2');

  const itemsA=data(await s.a.rpc('get_my_cosmetics'),'A base cosmetics');
  const itemsB=data(await s.b.rpc('get_my_cosmetics'),'B base cosmetics');
  assert.ok(itemsA.items.some(x=>x.code==='piece-classic'&&x.owned));
  assert.ok(itemsB.items.some(x=>x.code==='avatar-classic'&&x.owned));
  const equip=data(await s.a.rpc('equip_my_cosmetic',{p_item_code:'piece-classic'}),
    'A equip owned starter');
  assert.equal(equip.pieceCode,'piece-classic');
  console.log('PASS: A/B starter cosmetic inventory and A starter equip');

  const file=privateStateFile(tag,{
    project:PROJECT_HOST,runId:tag,roomId,code,userA:s.userA,userB:s.userB,
    xpBeforeA:beforeA.totalXp,xpBeforeB:beforeB.totalXp,dmCount,
    phase:'awaiting_casual_match',createdAt:new Date().toISOString(),
  });
  console.log('PASS PREPARE: state stored privately at '+file);
  console.log('PLAY NOW in two separate authenticated browsers:');
  console.log('  https://alkkagi-alpha.vercel.app/rooms/'+roomId);
  console.log('  A is host/seat 1, B is guest/seat 2. Start/finish ONE casual match.');
  console.log('  Room code: '+code);
  console.log('  Then run: node --env-file=.env.local tests/e2e/hosted-two-account.mjs verify '+file);
}
async function verify(s,path) {
  assert.ok(typeof path==='string' && path.endsWith('.json'),'Private state file path required');
  const file=resolve(path);
  const state=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(state.project,PROJECT_HOST);
  assert.equal(state.userA,s.userA,'Different A account from prepare');
  assert.equal(state.userB,s.userB,'Different B account from prepare');
  assert.equal(state.phase,'awaiting_casual_match');
  const m=data(await s.a.from('matches')
    .select('id,status,winner_id,mode').eq('room_id',state.roomId)
    .order('created_at',{ascending:false}).limit(1).maybeSingle(),'Finished casual match');
  assert.equal(m.status,'finished','Match still ongoing; complete one normal casual game');
  assert.equal(m.mode,'casual','Ranked match used unexpectedly');
  const xpA=data(await s.a.rpc('get_player_experience',{p_player_id:s.userA}),'A XP after');
  const xpB=data(await s.b.rpc('get_player_experience',{p_player_id:s.userB}),'B XP after');
  const expectedA=m.winner_id===s.userA?40:m.winner_id===s.userB?20:25;
  const expectedB=m.winner_id===s.userB?40:m.winner_id===s.userA?20:25;
  const rowsA=data(await s.a.from('xp_events')
    .select('source_id,xp_amount').eq('source_kind','casual').eq('source_id',m.id)
    .eq('user_id',s.userA),'A XP ledger');
  const rowsB=data(await s.b.from('xp_events')
    .select('source_id,xp_amount').eq('source_kind','casual').eq('source_id',m.id)
    .eq('user_id',s.userB),'B XP ledger');
  assert.equal(rowsA.length,1,'Missing/duplicate A XP ledger');
  assert.equal(rowsB.length,1,'Missing/duplicate B XP ledger');
  assert.equal(rowsA[0].xp_amount,expectedA);
  assert.equal(rowsB[0].xp_amount,expectedB);
  assert.ok(xpA.totalXp>=state.xpBeforeA+expectedA);
  assert.ok(xpB.totalXp>=state.xpBeforeB+expectedB);
  await ownRls(s);
  console.log('PASS VERIFY: real casual match completed, XP ledgers unique; expected A/B '+expectedA+'/'+expectedB);
  console.log('PASS HOSTED TWO ACCOUNT E2E: authenticated, RLS, friend, DM Realtime, invite, casual, XP, cosmetics');
  console.log('State file remains local; all test rows retained (no deletes).');
}
async function main() {
  const mode=process.argv[2];
  if(!['prepare','verify'].includes(mode)) {
    console.log('Usage: node --env-file=.env.local tests/e2e/hosted-two-account.mjs prepare --approved-writes');
    console.log('   or: node --env-file=.env.local tests/e2e/hosted-two-account.mjs verify /path/to/private-state.json');
    process.exitCode=2;
    return;
  }
  if(mode==='prepare') assert.ok(process.argv.includes('--approved-writes'),
    'Explicit --approved-writes required: production account mutations');
  const {url,key}=requirePublishableConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  console.log('Target: fixed production Supabase project, existing users ONLY.');
  console.log('No signup, admin key, SQL migration, deletes, feature flags or Vercel deployment.');
  const s=await sessions(url,key);
  try {
    if(mode==='prepare')await prepare(s);else await verify(s,process.argv[3]);
  } finally {
    await Promise.allSettled([s.a.removeAllChannels(),s.b.removeAllChannels(),s.guest.removeAllChannels()]);
    await Promise.allSettled([s.a.auth.signOut({scope:'local'}),s.b.auth.signOut({scope:'local'})]);
  }
}
if(process.argv[1] && import.meta.url===new URL('file://'+resolve(process.argv[1])).href) {
  main().catch(err=>{
    // SQL errors may contain PII or request details; only report safe text
    // from our own exception sites, never raw Supabase error or credentials.
    const safe=String(err?.message||'UNKNOWN').replace(/[^\p{L}\p{N} ./_[\]-]/gu,'').slice(0,180);
    console.error('FAIL HOSTED E2E: '+safe);
    process.exitCode=1;
  });
}
