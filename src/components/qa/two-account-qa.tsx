'use client';

import {createBrowserClient} from '@supabase/ssr';
import {useEffect,useRef,useState} from 'react';
import {
  qaDmIdentity,qaPeerAllowed,qaReward,qaScopeMatch,qaScopeRoom,qaScopeSeats,
  qaUuid,type QaMatch,type QaPair,type QaRoom,type QaSeat,type QaSnapshot,
} from '@/lib/qa/two-account-guards';

type Friend={id:string;userId?:string};
type Friends={friends:Friend[];incoming:Friend[];outgoing:Friend[]};
type Invite={id:string;roomId:string;inviterId:string};
type Sent={id:string;body:string;alreadySent:boolean};
type Experience={totalXp:number;level:number};
type EventRow={id:string;body:string};
const project='https://igjvccohxthmgbfilzxi.supabase.co';

async function api<T>(path:string,method:'GET'|'POST'|'PUT'='GET',body?:unknown):Promise<T>{
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
    ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const json=await response.json().catch(()=>null) as {data?:T;error?:string}|null;
  if(!response.ok||json?.data===undefined)
    throw Error('HTTP '+response.status+' '+(json?.error??'INVALID_RESPONSE'));
  return json.data;
}
function database(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(url!==project||!key)throw Error('QA_PROJECT_MISMATCH');
  return createBrowserClient(url,key);
}
async function qaRoomState(roomId:string){
  const db=database();
  const [{data:room,error:roomError},{data:seats,error:seatsError}]=await Promise.all([
    db.from('rooms').select('id,owner_id,created_at,status').eq('id',roomId).maybeSingle(),
    db.from('room_players').select('user_id,seat').eq('room_id',roomId),
  ]);
  if(roomError||seatsError)throw Error('QA_ROOM_QUERY_FAILED');
  return {room:room as QaRoom|null,seats:(seats??[]) as QaSeat[]};
}

async function qaDailyCounts(userId:string,peerId:string,now:Date){
  const db=database();
  const utcStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();
  const base=()=>db.from('xp_events').select('id',{count:'exact',head:true})
    .eq('user_id',userId).gte('created_at',utcStart);
  const [pvp,casual]=await Promise.all([
    base().in('source_kind',['casual','ranked']),
    base().eq('source_kind','casual').eq('opponent_id',peerId),
  ]);
  if(pvp.error||casual.error||pvp.count===null||casual.count===null)
    throw Error('QA_XP_CAP_QUERY_FAILED');
  return {dailyPvp:pvp.count,dailyCasualPeer:casual.count};
}

export function TwoAccountQa({userId,pair}:{userId:string;pair:QaPair}){
  const peer=pair.otherUserId;
  const role=pair.role;
  const [room,setRoom]=useState('');
  const [approved,setApproved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('먼저 두 계정에서 내 인증·XP 기준을 확인하세요.');
  const [checkpoints,setCheckpoints]=useState<string[]>([]);
  const [snapshot,setSnapshot]=useState<QaSnapshot|null>(null);
  const [dmSent,setDmSent]=useState<{marker:string;id:string}|null>(null);
  const [checkMarker,setCheckMarker]=useState('');
  const [checkId,setCheckId]=useState('');
  const [events,setEvents]=useState<EventRow[]>([]);
  const [subscription,setSubscription]=useState('미구독');
  const realtime=useRef<{cleanup:()=>void}|null>(null);
  const inFlight=useRef(false);
  useEffect(()=>()=>{realtime.current?.cleanup();},[]);

  function record(message:string){
    setNotice('PASS: '+message);
    setCheckpoints(previous=>[...previous,message].slice(-20));
  }
  function run(name:string,task:()=>Promise<void>,writes=false){
    if(busy||inFlight.current)return;
    if(!qaPeerAllowed(userId,peer,pair)){
      setNotice('STOP: 서버 승인 A/B 계정 불일치');return;
    }
    if(writes&&!approved){setNotice('STOP: 운영 데이터 쓰기 동의 체크 필요');return;}
    if(writes&&!snapshot){setNotice('STOP: 내 Auth·XP 기준 확인을 먼저 진행하세요');return;}
    inFlight.current=true;
    setBusy(true);
    setNotice('검증 중: '+name);
    void task().catch(err=>{
      // Report only short, sanitized error codes. Never display raw SQL/auth
      // errors, session cookies, JWTs or user profile rows.
      const message=err instanceof Error?err.message:'UNKNOWN';
      const safe=/^(HTTP [0-9]{3} [A-Z0-9_]+|[A-Z0-9_]{3,90})$/.test(message)
        ? message:'UNKNOWN';
      setNotice('FAIL: '+name+' ('+safe+')');
    }).finally(()=>{inFlight.current=false;setBusy(false);});
  }
  const validRoom=qaUuid(room);

  async function verifySession(){
    const db=database();
    const {data,error}=await db.auth.getUser();
    if(error||data.user?.id.toLowerCase()!==userId.toLowerCase())
      throw Error('USER_SESSION_MISMATCH');
    const {data:self,error:selfError}=await db.from('profiles').select('id').eq('id',userId);
    if(selfError||self?.length!==1)throw Error('OWN_PROFILE_RLS_FAILED');
    const before=await api<Experience>('/api/experience/me');
    const now=new Date();
    const counts=await qaDailyCounts(userId,peer,now);
    setSnapshot({startedAt:now.toISOString(),totalXp:before.totalXp,...counts});
    record('A/B 서버 로그인·내 프로필 확인, 당일 PvP '+counts.dailyPvp+
      '/20·동일 상대 일반전 '+counts.dailyCasualPeer+'/5, XP 기준 저장');
  }
  async function verifyIsolation(){
    const db=database();
    const [p,i]=await Promise.all([
      db.from('profiles').select('id').eq('id',peer),
      db.from('player_cosmetic_inventory').select('item_code').eq('user_id',peer),
    ]);
    if(p.error||i.error||p.data?.length!==0||i.data?.length!==0)
      throw Error('CROSS_ACCOUNT_RLS_FAILED');
    record('상대 A/B 비공개 프로필·인벤토리 SELECT 차단');
  }
  async function sendFriend(){
    const current=await api<Friends>('/api/friends');
    if(current.friends.some(x=>x.id===peer)){
      record('기존 허용된 A/B 친구 관계 확인(신규 요청 없음)');return;
    }
    if(current.outgoing.some(x=>x.userId===peer)){
      setNotice('ALREADY EXISTS: A→B 친구 요청이 대기 중입니다');return;
    }
    const sent=await api<{requestId:string}>('/api/friends/requests','POST',{targetId:peer});
    if(!qaUuid(sent.requestId))throw Error('INVALID_FRIEND_REQUEST');
    record('A → B 친구 요청 1건 생성');
  }
  async function acceptFriend(){
    const current=await api<Friends>('/api/friends');
    if(current.friends.some(x=>x.id===peer)){
      record('기존 수락된 A/B 친구 관계 확인');return;
    }
    const found=current.incoming.find(x=>x.userId===peer);
    if(!found)throw Error('NO_INCOMING_FRIEND_REQUEST');
    const accepted=await api<{status:string}>(
      '/api/friends/requests/'+encodeURIComponent(found.id)+'/respond','POST',{accept:true});
    if(accepted.status!=='accepted')throw Error('FRIEND_NOT_ACCEPTED');
    record('B의 A→B 친구 요청 수락');
  }
  async function startRealtime(){
    if(realtime.current)throw Error('ALREADY_SUBSCRIBED');
    const db=database();
    const {data,error}=await db.auth.getSession();
    if(error||!data.session?.access_token)throw Error('NO_USER_SESSION');
    db.realtime.setAuth(data.session.access_token);
    const channel=db.channel('ops-e2e-'+crypto.randomUUID())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages'},payload=>{
        const next=payload.new as Record<string,unknown>;
        if((typeof next.id==='number'||typeof next.id==='string')&&typeof next.body==='string')
          setEvents(previous=>[...previous,{id:String(next.id),body:next.body as string}].slice(-10));
      }).subscribe(status=>{
        if(status==='SUBSCRIBED')setSubscription('구독 연결됨 · 실제 INSERT 수신 대기');
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')
          setSubscription('구독 오류: '+status);
      });
    realtime.current={cleanup:()=>{void db.removeChannel(channel);}};
    setSubscription('연결 중');
    setNotice('구독 연결 대기 중: SUBSCRIBED 확인 전 메시지를 보내지 마세요');
  }
  async function sendMessage(){
    // The same A/B pair ALWAYS uses the same requestId, even after a reload
    // or between two concurrent tabs. SQL guarantees (thread,sender,requestId)
    // idempotency so only one QA DM can be created by this feature version.
    const {requestId,marker}=await qaDmIdentity(pair.userA,pair.userB);
    const history=await api<{messages:{id:string;body:string}[]}>(
      '/api/messages/'+encodeURIComponent(peer)+'?limit=50');
    const existing=history.messages.find(m=>m.body===marker);
    if(existing){
      setDmSent({id:existing.id,marker});
      setNotice('ALREADY EXISTS: 이 A/B의 QA DM은 이미 발송됐습니다. 신규 INSERT 이벤트 재검증 불가');
      return;
    }
    const sent=await api<Sent>('/api/messages/'+encodeURIComponent(peer),'POST',
      {body:marker,requestId});
    if(!/^[1-9][0-9]*$/.test(sent.id)||sent.body!==marker)
      throw Error('DM_RESPONSE_MISMATCH');
    setDmSent({id:sent.id,marker});
    if(sent.alreadySent){
      setNotice('ALREADY EXISTS: SQL requestId가 이전 메시지로 재사용됐습니다. 추가 발송 0건');
      return;
    }
    record('A → B DM 한 건만 신규 저장. Marker/ID를 B 브라우저에 전달');
  }
  async function verifyRealtime(){
    if(!checkMarker.startsWith('ALK-QA-')||!/^[1-9][0-9]*$/.test(checkId))
      throw Error('ENTER_A_DM_MARKER_AND_ID');
    const expected=await qaDmIdentity(pair.userA,pair.userB);
    if(checkMarker!==expected.marker)throw Error('DM_WRONG_QA_PAIR');
    const received=events.some(e=>e.id===checkId&&e.body===checkMarker);
    if(!received)throw Error('REALTIME_INSERT_NOT_OBSERVED');
    const history=await api<{messages:{id:string;body:string}[]}>(
      '/api/messages/'+encodeURIComponent(peer)+'?limit=50');
    if(!history.messages.some(e=>e.id===checkId&&e.body===checkMarker))
      throw Error('DM_HISTORY_ID_MISMATCH');
    record('B 실제 WebSocket INSERT ID = A DM 전송 ID = B API 조회 ID');
  }
  async function scopeRoomForHost(){
    if(!validRoom)throw Error('ENTER_ROOM_UUID');
    const info=await qaRoomState(room);
    if(!qaScopeRoom(info.room,pair,snapshot)||info.room?.status!=='waiting'||
      info.seats.length!==1||info.seats[0].seat!==1||
      info.seats[0].user_id!==pair.userA)
      throw Error('NOT_THIS_QA_ROOM_OR_HOST');
    return info;
  }
  async function inviteFriend(){
    await scopeRoomForHost();
    // READ-FIRST: once an invitation to B has been created for this room,
    // accepted/declined/expired counts as already spent. Never POST twice.
    const sent=await api<{inviteeId:string;status:string}[]>(
      '/api/room-invites/sent?roomId='+encodeURIComponent(room));
    if(sent.some(x=>x.inviteeId===peer)){
      setNotice('ALREADY EXISTS: A→B 초대 기록 존재. 같은 방에 다시 보내지 않습니다');
      return;
    }
    const created=await api<{inviteId:string}>('/api/room-invites','POST',
      {roomId:room,targetId:peer});
    if(!qaUuid(created.inviteId))throw Error('INVITE_ID_MISSING');
    record('A → B 새 QA 방 초대 1건 발송');
  }
  async function acceptInvite(){
    if(!validRoom)throw Error('ENTER_ROOM_UUID');
    const received=await api<Invite[]>('/api/room-invites');
    const invite=received.find(x=>x.inviterId===peer&&x.roomId===room);
    if(!invite){
      const info=await qaRoomState(room);
      if(qaScopeRoom(info.room,pair,snapshot)&&qaScopeSeats(info.seats,pair)){
        setNotice('ALREADY EXISTS: B의 해당 QA 방 seat 2 참여가 확인됩니다. 추가 초대 수락 0건');
        return;
      }
      throw Error('NO_RECEIVED_INVITE');
    }
    const response=await api<{status:string;roomId:string}>(
      '/api/room-invites/'+encodeURIComponent(invite.id)+'/respond','POST',{accept:true});
    if(response.status!=='accepted'||response.roomId!==room)
      throw Error('INVITE_NOT_ACCEPTED');
    const info=await qaRoomState(room);
    const db=database();
    const {data,error}=await db.rpc('get_casual_room',{p_room_id:room});
    if(!qaScopeRoom(info.room,pair,snapshot)||!qaScopeSeats(info.seats,pair)||
      error||data?.yourSeat!==2)throw Error('SEAT_2_NOT_CONFIRMED');
    record('B의 허용된 A/B 초대 수락·seat 2 확인');
  }
  async function verifyGame(){
    if(!validRoom||!snapshot)throw Error('BASELINE_OR_ROOM_REQUIRED');
    const currentUtc=new Date().toISOString().slice(0,10);
    if(snapshot.startedAt.slice(0,10)!==currentUtc)
      throw Error('UTC_DAY_CHANGED_BASELINE_EXPIRED');
    const db=database();
    const [info,{data:match,error}]=await Promise.all([
      qaRoomState(room),
      db.from('matches').select('id,room_id,status,mode,winner_id,player1_id,player2_id,created_at')
        .eq('room_id',room).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(error||!qaScopeMatch(match as QaMatch|null,info.room,info.seats,pair,snapshot))
      throw Error('QA_PAIR_ROOM_MATCH_SCOPE_FAILED');
    const item=match as QaMatch;
    const expected=item.winner_id===userId?40:item.winner_id===null?25:20;
    const {data:rewards,error:ledgerError}=await db.from('xp_events')
      .select('source_id,xp_amount').eq('source_kind','casual')
      .eq('source_id',item.id).eq('user_id',userId);
    if(ledgerError||rewards?.length!==1)throw Error('XP_LEDGER_NOT_UNIQUE');
    const decision=qaReward(snapshot,item.winner_id===userId,item.winner_id===null,
      rewards[0].xp_amount);
    if(decision.expected!==expected||decision.kind==='invalid')
      throw Error('XP_REWARD_OR_CAP_MISMATCH');
    const current=await api<Experience>('/api/experience/me');
    const gained=decision.kind==='capped'?0:expected;
    if(current.totalXp!==snapshot.totalXp+gained)
      throw Error('XP_TOTAL_DELTA_MISMATCH');
    if(decision.kind==='capped'){
      setNotice('LIMITED: A/B 경기·원장 1행·XP 0 정상(UTC 일일20/동일 상대5 한도). '+
        'XP 지급 성공으로 처리하지 않습니다');
      return;
    }
    record('정확한 A/B 일반전 종료·내 XP 원장 1행·+'+expected+' XP·기준값 대비 증가 확인');
  }
  async function checkCosmetics(){
    const owned=await api<{items:{code:string;owned:boolean}[];loadout:{pieceCode:string}}>('/api/cosmetics/me');
    if(!owned.items.some(x=>x.code==='piece-classic'&&x.owned))
      throw Error('STARTER_COSMETIC_MISSING');
    const equipped=await api<{pieceCode:string}>('/api/cosmetics/equip','PUT',
      {itemCode:'piece-classic'});
    if(equipped.pieceCode!=='piece-classic')throw Error('EQUIP_NOT_CONFIRMED');
    record('내 기본 아이템 보유/장착 확인');
  }
  const button=(text:string,fn:()=>Promise<void>,write=false,disabled=false)=>
    <button type="button" disabled={busy||disabled||(write&&!approved)||!snapshot&&write}
      onClick={()=>run(text,fn,write)}
      className="rounded-lg border border-amber-600 bg-slate-950 px-3 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-40">{text}</button>;
  const inputClass='w-full rounded border border-slate-500 bg-slate-950 p-2 text-sm text-white';

  return <div className="space-y-4 text-sm">
    <section className="rounded-xl border border-amber-700 bg-slate-900 p-4">
      <p className="font-bold">운영 쓰기 주의 · A/B만 허용</p>
      <p>친구·DM·초대·경기·아이템 기록은 운영 DB에 남습니다. 자동 삭제·관리자 권한·새 계정 생성은 없습니다. 같은 단계의 쓰기 버튼을 반복하지 마세요.</p>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>
        승인된 운영 테스트 데이터 쓰기에 동의합니다
      </label>
      <p className="mt-2">서버 승인 역할: <strong>{role}</strong> / 로그인 사용자: <code className="break-all">{userId}</code></p>
      <p>허용된 상대 계정(고정): <code className="break-all">{peer}</code></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {button('내 Auth·XP 기준 확인 (모든 쓰기 전에)',verifySession)}
      </div>
      {snapshot&&<p className="mt-2">UTC 기준: {snapshot.startedAt} / XP: {snapshot.totalXp} /
        오늘 PvP: {snapshot.dailyPvp}/20 / 동일 상대 일반전: {snapshot.dailyCasualPeer}/5
      </p>}
    </section>
    <section className="rounded-xl border border-slate-600 p-4">
      <h2 className="mb-2 text-lg font-bold">1. 승인된 상대·RLS·친구</h2>
      <div className="flex flex-wrap gap-2">
        {button('상대 비공개 데이터 접근 차단 확인',verifyIsolation)}
        {role==='A'?button('A→B 친구 요청',sendFriend,true):
          button('B 친구 요청 수락',acceptFriend,true)}
      </div>
    </section>
    <section className="rounded-xl border border-slate-600 p-4">
      <h2 className="mb-2 text-lg font-bold">2. DM·실제 Realtime</h2>
      {role==='B'&&<>{button('B: INSERT 구독 시작',startRealtime)}
        <p className="mt-2" role="status">{subscription}</p></>}
      {role==='A'&&<>{button('A: QA DM 최대 1건 발송',sendMessage,true,dmSent!==null)}
        {dmSent&&<p className="mt-2 break-all">B에게 전달할 Marker: <code>{dmSent.marker}</code>
          <span className="block">메시지 ID: <code>{dmSent.id}</code></span></p>}</>}
      {role==='B'&&<div className="mt-3 space-y-2">
        <p>구독 연결됨 표시 후 A에게 발송을 요청하세요. 기존 메시지 재조회만으로 Realtime PASS가 되지 않습니다.</p>
        <input aria-label="A DM Marker" className={inputClass} value={checkMarker}
          onChange={e=>setCheckMarker(e.target.value)} placeholder="A DM Marker"/>
        <input aria-label="A 메시지 ID" className={inputClass} value={checkId}
          onChange={e=>setCheckId(e.target.value)} placeholder="A 메시지 ID"/>
        {button('WebSocket 수신 ID = API 조회 ID 확인',verifyRealtime)}
        <p>실제 수신한 INSERT 이벤트: {events.length}건</p>
      </div>}
    </section>
    <section className="rounded-xl border border-slate-600 p-4">
      <h2 className="mb-2 text-lg font-bold">3. 새 QA 방·초대·일반전</h2>
      <p>A가 <a className="underline" href="/lobby" target="_blank" rel="noopener noreferrer">로비</a>에서
        이번 테스트의 일반전 방 딱 1개를 새로 만들고 UUID를 A/B 양쪽에 넣으세요.
        양쪽에서 Auth·XP 기준을 먼저 확인한 뒤 방을 생성해야 합니다.</p>
      <input aria-label="QA 일반전 방 UUID" className={inputClass}
        value={room} onChange={e=>setRoom(e.target.value.trim())}
        placeholder="이번에 생성한 방 URL /rooms/ 뒤의 UUID"/>
      <div className="mt-3 flex flex-wrap gap-2">
        {role==='A'?button('A: QA 방 초대 최대 1건 발송',inviteFriend,true,!validRoom):
          button('B: 초대 수락·seat 2 확인',acceptInvite,true,!validRoom)}
        {validRoom&&<a className="rounded border p-2 underline" href={'/rooms/'+room}
          target="_blank" rel="noopener noreferrer">실제 일반전 열기</a>}
      </div>
      <p className="mt-2">한 판을 정상 종료한 뒤 두 계정에서 XP를 확인하세요. 기준 확인 없이 새로고침했으면 이 경기의 XP 지급을 PASS 처리하지 않습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {button('실제 A/B 경기·XP 원장·누적 검증',verifyGame,false,!validRoom||!snapshot)}
        {button('내 기본 코스메틱 보유·장착 확인',checkCosmetics,true)}
      </div>
    </section>
    <section className="rounded-xl border border-slate-500 p-4" aria-live="polite">
      <h2 className="font-bold">검증 현황</h2>
      <p className="mt-2 break-words" role="status">{notice}</p>
      <ol className="mt-2 list-inside list-decimal space-y-1">{checkpoints.map((s,i)=><li key={i}>{s}</li>)}</ol>
      <p className="mt-2 text-xs">PASS는 해당 단계만, LIMITED는 XP 제한으로 보상 미지급·전체 XP 지급 PASS 아님, ALREADY EXISTS는 새로 쓴 데이터가 없음을 뜻합니다. 브라우저 전체 QA 결과는 별도 승인된 실제 배포에서 검증해야 합니다.</p>
    </section>
  </div>;
}
