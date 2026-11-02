'use client';

import {createBrowserClient} from '@supabase/ssr';
import {useEffect,useRef,useState} from 'react';
import {isDmPeerId} from '@/components/messages/message-api';

type Friend={id:string;userId?:string};
type Friends={friends:Friend[];incoming:Friend[];outgoing:Friend[]};
type Invite={id:string;roomId:string;inviterId:string};
type Sent={id:string;body:string;alreadySent:boolean};
type Experience={totalXp:number;level:number};
type Match={id:string;status:string;mode:string;winner_id:string|null};
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
  if(url!==project||!key)throw Error('QA Supabase project configuration mismatch');
  return createBrowserClient(url,key);
}

export function TwoAccountQa({userId}:{userId:string}){
  const [peer,setPeer]=useState('');
  const [room,setRoom]=useState('');
  const [role,setRole]=useState<'A'|'B'>('A');
  const [approved,setApproved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('먼저 내 인증을 확인하고 상대의 UUID를 입력하세요.');
  const [checkpoints,setCheckpoints]=useState<string[]>([]);
  const [xpBefore,setXpBefore]=useState<number|null>(null);
  const [dmSent,setDmSent]=useState<{marker:string;id:string}|null>(null);
  const [checkMarker,setCheckMarker]=useState('');
  const [checkId,setCheckId]=useState('');
  const [events,setEvents]=useState<EventRow[]>([]);
  const [subscription,setSubscription]=useState('미구독');
  const realtime=useRef<{cleanup:()=>void}|null>(null);

  useEffect(()=>()=>{realtime.current?.cleanup();},[]);

  function record(message:string){
    setNotice('PASS: '+message);
    setCheckpoints(previous=>[...previous,message].slice(-20));
  }
  function run(name:string,task:()=>Promise<void>,writes=false){
    if(busy)return;
    if(writes&&!approved){setNotice('STOP: 운영 데이터 쓰기 동의 체크 필요');return;}
    setBusy(true);
    setNotice('검증 중: '+name);
    void task().catch(err=>{
      // Do not display a raw SQL error, session data or token.
      const message=err instanceof Error?err.message:'UNKNOWN';
      const safe=/^(HTTP [0-9]{3} [A-Z0-9_]+|[A-Za-z0-9 .:/_-]{1,90})$/.test(message)
        ? message:'UNKNOWN';
      setNotice('FAIL: '+name+' ('+safe+')');
    }).finally(()=>setBusy(false));
  }
  const validPeer=isDmPeerId(peer)&&peer!==userId;
  const validRoom=isDmPeerId(room);

  async function verifySession(){
    const db=database();
    const {data,error}=await db.auth.getUser();
    if(error||data.user?.id!==userId)throw Error('USER_SESSION_MISMATCH');
    const {data:self, error:selfError}=await db.from('profiles').select('id').eq('id',userId);
    if(selfError||self?.length!==1)throw Error('OWN_PROFILE_RLS_FAILED');
    const xp=await api<Experience>('/api/experience/me');
    setXpBefore(xp.totalXp);
    record('실제 로그인 세션·내 프로필·XP 기준값 확인');
  }
  async function verifyIsolation(){
    if(!validPeer)throw Error('ENTER_OTHER_ACCOUNT_UUID');
    const db=database();
    const [p,i]=await Promise.all([
      db.from('profiles').select('id').eq('id',peer),
      db.from('player_cosmetic_inventory').select('item_code').eq('user_id',peer),
    ]);
    if(p.error||i.error||p.data?.length!==0||i.data?.length!==0)
      throw Error('CROSS_ACCOUNT_RLS_FAILED');
    record('상대의 비공개 프로필·인벤토리 SELECT 차단');
  }
  async function sendFriend(){
    if(!validPeer)throw Error('ENTER_OTHER_ACCOUNT_UUID');
    const current=await api<Friends>('/api/friends');
    if(current.friends.some(x=>x.id===peer)){record('기존 친구 관계 확인(신규 요청 없음)');return;}
    const sent=await api<{requestId:string}>('/api/friends/requests','POST',{targetId:peer});
    if(!isDmPeerId(sent.requestId))throw Error('INVALID_FRIEND_REQUEST');
    record('A → B 친구 요청 생성');
  }
  async function acceptFriend(){
    if(!validPeer)throw Error('ENTER_OTHER_ACCOUNT_UUID');
    const current=await api<Friends>('/api/friends');
    if(current.friends.some(x=>x.id===peer)){record('기존 수락 친구 확인');return;}
    const found=current.incoming.find(x=>x.userId===peer);
    if(!found)throw Error('NO_INCOMING_FRIEND_REQUEST');
    const accepted=await api<{status:string}>(
      '/api/friends/requests/'+encodeURIComponent(found.id)+'/respond','POST',{accept:true});
    if(accepted.status!=='accepted')throw Error('FRIEND_NOT_ACCEPTED');
    record('B의 친구 요청 수락 및 상태 확인');
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
        if(typeof next.id==='number'||typeof next.id==='string'){
          if(typeof next.body==='string')
            setEvents(previous=>[...previous,{id:String(next.id),body:next.body as string}].slice(-10));
        }
      }).subscribe(status=>{
        if(status==='SUBSCRIBED')setSubscription('구독 연결됨 · 실제 INSERT 수신 대기');
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')
          setSubscription('구독 오류: '+status);
      });
    realtime.current={cleanup:()=>{void db.removeChannel(channel);}};
    setSubscription('연결 중');
    record('B JWT로 Realtime 구독 시작(이벤트 수신은 아직 미검증)');
  }
  async function sendMessage(){
    if(!validPeer)throw Error('ENTER_OTHER_ACCOUNT_UUID');
    const marker='ALK-QA-'+crypto.randomUUID();
    const result=await api<Sent>('/api/messages/'+encodeURIComponent(peer),'POST',
      {body:marker,requestId:crypto.randomUUID()});
    if(!/^[1-9][0-9]*$/.test(result.id)||result.body!==marker)
      throw Error('DM_RESPONSE_MISMATCH');
    setDmSent({id:result.id,marker});
    record('A → B DM 1건 저장. 아래 Marker/ID를 B 브라우저에 전달');
  }
  async function verifyRealtime(){
    if(!validPeer||!checkMarker.startsWith('ALK-QA-')||!/^[1-9][0-9]*$/.test(checkId))
      throw Error('ENTER_A_DM_MARKER_AND_ID');
    const received=events.some(e=>e.id===checkId&&e.body===checkMarker);
    if(!received)throw Error('REALTIME_INSERT_NOT_OBSERVED');
    const history=await api<{messages:{id:string;body:string}[]}>(
      '/api/messages/'+encodeURIComponent(peer)+'?limit=50');
    if(!history.messages.some(e=>e.id===checkId&&e.body===checkMarker))
      throw Error('DM_HISTORY_ID_MISMATCH');
    record('B WebSocket INSERT ID = A 전송 ID = B API 조회 ID');
  }
  async function inviteFriend(){
    if(!validPeer||!validRoom)throw Error('ENTER_PEER_AND_ROOM_UUID');
    const sent=await api<{inviteId:string}>('/api/room-invites','POST',
      {roomId:room,targetId:peer});
    if(!isDmPeerId(sent.inviteId))throw Error('INVITE_ID_MISSING');
    record('A → B 방 초대 1건 발송');
  }
  async function acceptInvite(){
    if(!validPeer||!validRoom)throw Error('ENTER_PEER_AND_ROOM_UUID');
    const received=await api<Invite[]>('/api/room-invites');
    const invite=received.find(x=>x.inviterId===peer&&x.roomId===room);
    if(!invite)throw Error('NO_RECEIVED_INVITE');
    const response=await api<{status:string;roomId:string}>(
      '/api/room-invites/'+encodeURIComponent(invite.id)+'/respond','POST',{accept:true});
    if(response.status!=='accepted'||response.roomId!==room)throw Error('INVITE_NOT_ACCEPTED');
    const db=database();
    const {data,error}=await db.rpc('get_casual_room',{p_room_id:room});
    if(error||data?.yourSeat!==2)throw Error('SEAT_2_NOT_CONFIRMED');
    record('B의 초대 수락 및 2번 좌석 확인');
  }
  async function verifyGame(){
    if(!validRoom)throw Error('ENTER_ROOM_UUID');
    const db=database();
    const {data:match,error}=await db.from('matches')
      .select('id,status,mode,winner_id').eq('room_id',room)
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error||!match||match.status!=='finished'||match.mode!=='casual')
      throw Error('CASUAL_MATCH_NOT_FINISHED');
    const item=match as Match;
    const expected=item.winner_id===userId?40:item.winner_id===null?25:20;
    const {data:rewards,error:ledgerError}=await db.from('xp_events')
      .select('source_id,xp_amount').eq('source_kind','casual')
      .eq('source_id',item.id).eq('user_id',userId);
    if(ledgerError||rewards?.length!==1||rewards[0].xp_amount!==expected)
      throw Error('XP_LEDGER_NOT_UNIQUE_OR_VALUE_MISMATCH');
    const xp=await api<Experience>('/api/experience/me');
    if(xpBefore!==null&&xp.totalXp<xpBefore+expected)throw Error('XP_TOTAL_NOT_UPDATED');
    record('실제 일반전 종료·내 XP 원장 정확히 1행·+'+expected+' XP 확인');
  }
  async function checkCosmetics(){
    const owned=await api<{items:{code:string;owned:boolean}[];loadout:{pieceCode:string}}>('/api/cosmetics/me');
    if(!owned.items.some(x=>x.code==='piece-classic'&&x.owned))throw Error('STARTER_COSMETIC_MISSING');
    const equipped=await api<{pieceCode:string}>('/api/cosmetics/equip','PUT',
      {itemCode:'piece-classic'});
    if(equipped.pieceCode!=='piece-classic')throw Error('EQUIP_NOT_CONFIRMED');
    record('내 기본 아이템 생성/보유/장착 확인');
  }

  const button=(text:string,fn:()=>Promise<void>,write=false,disabled=false)=>
    <button type="button" disabled={busy||disabled||(write&&!approved)}
      onClick={()=>run(text,fn,write)}
      className="rounded-lg border border-amber-600 bg-slate-950 px-3 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-40">{text}</button>;
  const inputClass='w-full rounded border border-slate-500 bg-slate-950 p-2 text-sm text-white';
  return <div className="space-y-4 text-sm">
    <section className="rounded-xl border border-amber-700 bg-slate-900 p-4">
      <p className="font-bold">운영 쓰기 주의</p>
      <p>친구·DM·초대·경기·아이템 기록이 운영 DB에 남습니다. 자동 삭제, 서비스 관리자 권한, 새 계정 생성은 없습니다. 각 버튼은 한 번만 누르세요.</p>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>
        승인된 범위의 운영 테스트 쓰기에 동의합니다.
      </label>
      <p className="mt-2">현재 로그인 사용자 UUID(비밀번호나 토큰 아님): <code className="select-all break-all">{userId}</code></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label>A/B 역할
          <select value={role} onChange={e=>setRole(e.target.value as 'A'|'B')} className={inputClass}>
            <option value="A">A (친구 요청·DM·초대 발신)</option>
            <option value="B">B (수락·Realtime 수신)</option>
          </select>
        </label>
        {button('내 Auth·XP 기준 확인',verifySession)}
      </div>
    </section>
    <section className="rounded-xl border border-slate-600 p-4">
      <h2 className="mb-2 text-lg font-bold">1. 상대 계정과 RLS</h2>
      <label className="block">상대 플레이어 UUID
        <input aria-label="상대 플레이어 UUID" value={peer} onChange={e=>setPeer(e.target.value.trim())}
          className={inputClass} placeholder="다른 브라우저에 표시된 UUID"/>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {button('상대 비공개 데이터 차단 확인',verifyIsolation,false,!validPeer)}
        {role==='A'?button('친구 요청',sendFriend,true,!validPeer):
          button('받은 친구 요청 수락',acceptFriend,true,!validPeer)}
      </div>
    </section>
    <section className="rounded-xl border border-slate-600 p-4">
      <h2 className="mb-2 text-lg font-bold">2. DM·실제 Realtime</h2>
      {role==='B'&&<>{button('B: INSERT 구독 시작',startRealtime)}
        <p className="mt-2" role="status">{subscription}</p></>}
      {role==='A'&&<>{button('A: 테스트 DM 한 건 보내기',sendMessage,true,!validPeer)}
        {dmSent&&<p className="mt-2 break-all">B에게 전달할 Marker: <code>{dmSent.marker}</code>
          <span className="block">메시지 ID: <code>{dmSent.id}</code></span></p>}</>}
      {role==='B'&&<div className="mt-3 space-y-2">
        <p>먼저 구독이 연결된 것을 확인하고 A에게 DM 전송을 요청하세요.</p>
        <input aria-label="A가 전송한 DM Marker" className={inputClass} value={checkMarker}
          onChange={e=>setCheckMarker(e.target.value)} placeholder="A의 DM Marker"/>
        <input aria-label="A가 전송한 메시지 ID" className={inputClass} value={checkId}
          onChange={e=>setCheckId(e.target.value)} placeholder="A의 메시지 ID"/>
        {button('WebSocket 수신 ID = API 조회 ID 확인',verifyRealtime,false,!validPeer)}
        <p>수신한 INSERT 이벤트: {events.length}건 (구독 이전 이벤트는 포함되지 않음)</p>
      </div>}
    </section>
    <section className="rounded-xl border border-slate-600 p-4">
      <h2 className="mb-2 text-lg font-bold">3. 초대와 실제 일반전</h2>
      <p>A가 <a className="underline" href="/lobby" target="_blank" rel="noopener noreferrer">로비</a>에서 일반전 방 1개를 만들고, 방 URL의 UUID를 A/B 양쪽에 입력하세요. 방 TTL 이내에 초대·수락을 완료해야 합니다.</p>
      <input aria-label="일반전 방 UUID" className={inputClass} value={room}
        onChange={e=>setRoom(e.target.value.trim())} placeholder="방 URL /rooms/ 뒤의 UUID"/>
      <div className="mt-3 flex flex-wrap gap-2">
        {role==='A'?button('A: 친구 방 초대 발송',inviteFriend,true,!validPeer||!validRoom):
          button('B: 초대 수락·seat 2 확인',acceptInvite,true,!validPeer||!validRoom)}
        {validRoom&&<a className="rounded border p-2 underline" href={'/rooms/'+room}
          target="_blank" rel="noopener noreferrer">실제 일반전 열기</a>}
      </div>
      <p className="mt-2">A/B가 정상 게임 화면에서 한 판을 완료한 뒤, 양쪽에서 각각 아래 XP 검증 버튼을 누르세요. 랭크전은 사용하지 않습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {button('내 경기 종료·XP 1회 지급 확인',verifyGame,false,!validRoom)}
        {button('내 기본 코스메틱 생성·장착 확인',checkCosmetics,true)}
      </div>
      {xpBefore!==null&&<p>이 브라우저의 검증 전 XP: {xpBefore} (새로고침하면 초기화)</p>}
    </section>
    <section className="rounded-xl border border-slate-500 p-4" aria-live="polite">
      <h2 className="font-bold">검증 현황</h2>
      <p className="mt-2 break-words" role="status">{notice}</p>
      <ol className="mt-2 list-inside list-decimal space-y-1">
        {checkpoints.map((s,i)=><li key={i}>{s}</li>)}
      </ol>
      <p className="mt-2 text-xs">PASS 문구는 각 단계의 성공만 의미합니다. A/B 모든 필수 항목의 PASS가 있어야 전체 인수 완료입니다. 이 화면의 출력에 인증 정보나 원문 DB 오류를 기록하지 않습니다.</p>
    </section>
  </div>;
}
