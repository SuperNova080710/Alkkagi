/**
 * Pure browser-QA guards. No database or network access. All identities come
 * from a server-validated 2-user allowlist, never a free-form QA input.
 */
export type QaRole='A'|'B';
export type QaPair={userA:string;userB:string;otherUserId:string;role:QaRole};
export type QaSnapshot={startedAt:string;totalXp:number;dailyPvp:number;dailyCasualPeer:number};
export type QaRoom={id:string;owner_id:string;created_at:string;status:string};
export type QaSeat={user_id:string;seat:number};
export type QaMatch={id:string;room_id:string;status:string;mode:string;winner_id:string|null;
  player1_id:string;player2_id:string;created_at:string};
export type QaReward={kind:'awarded'|'capped'|'invalid';expected:number;actual:number};

const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function qaUuid(id:unknown):id is string {
  return typeof id==='string'&&uuidRe.test(id);
}
export function resolveQaPair(config:string|undefined,actor:string):QaPair|null {
  const allowed=(config??'').split(',').map(x=>x.trim().toLowerCase());
  if(allowed.length!==2||!allowed.every(qaUuid)||allowed[0]===allowed[1]||
    !qaUuid(actor))return null;
  const who=actor.toLowerCase();
  if(who===allowed[0])return {userA:allowed[0],userB:allowed[1],otherUserId:allowed[1],role:'A'};
  if(who===allowed[1])return {userA:allowed[0],userB:allowed[1],otherUserId:allowed[0],role:'B'};
  return null;
}
export function qaPeerAllowed(actor:string,peer:string,pair:QaPair):boolean {
  return qaUuid(actor)&&qaUuid(peer)&&actor.toLowerCase()===
    (pair.role==='A'?pair.userA:pair.userB)&&peer.toLowerCase()===pair.otherUserId;
}

export function qaScopeRoom(room:QaRoom|null,pair:QaPair,snapshot:QaSnapshot|null):boolean {
  return Boolean(room&&snapshot&&room.owner_id===pair.userA&&
    qaUuid(room.id)&&Number.isFinite(Date.parse(room.created_at))&&
    Date.parse(room.created_at)>=Date.parse(snapshot.startedAt)&&
    Number.isFinite(Date.parse(snapshot.startedAt)));
}

export function qaScopeSeats(seats:QaSeat[],pair:QaPair):boolean {
  return seats.length===2&&seats.some(x=>x.seat===1&&x.user_id===pair.userA)&&
    seats.some(x=>x.seat===2&&x.user_id===pair.userB);
}

export function qaScopeMatch(
  match:QaMatch|null,room:QaRoom|null,seats:QaSeat[],pair:QaPair,snapshot:QaSnapshot|null,
):boolean {
  return qaScopeRoom(room,pair,snapshot)&&qaScopeSeats(seats,pair)&&Boolean(match&&
    match.room_id===room?.id&&match.status==='finished'&&match.mode==='casual'&&
    match.player1_id===pair.userA&&match.player2_id===pair.userB&&
    (match.winner_id===null||match.winner_id===pair.userA||match.winner_id===pair.userB)&&
    Number.isFinite(Date.parse(match.created_at))&&
    Date.parse(match.created_at)>=Date.parse(snapshot!.startedAt));
}

export function qaReward(
  snapshot:QaSnapshot,win:boolean,draw:boolean,actual:number,
):QaReward {
  const expected=draw?25:win?40:20;
  const capped=snapshot.dailyPvp>=20||snapshot.dailyCasualPeer>=5;
  if(!Number.isInteger(actual)||actual<0)return {kind:'invalid',expected,actual};
  if(capped)return {kind:actual===0?'capped':'invalid',expected,actual};
  return {kind:actual===expected?'awarded':'invalid',expected,actual};
}

export async function qaDmIdentity(userA:string,userB:string){
  if(!qaUuid(userA)||!qaUuid(userB)||userA===userB)throw Error('INVALID_QA_PAIR');
  const input=new TextEncoder().encode('alkkagi-ops-two-user-dm-v1:'+userA+':'+userB);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',input));
  // Stable UUIDv4 for the approved pair and test version. SQL's request_id
  // UNIQUE constraint makes same-pair retries idempotent, including tab reload.
  const bytes=hash.slice(0,16);
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  const requestId=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
  return {requestId,marker:'ALK-QA-'+requestId};
}


export function qaCanSendDm(history:{body:string}[],marker:string):boolean {
  return marker.startsWith('ALK-QA-')&&!history.some(entry=>entry.body===marker);
}

export function qaCanSendInvite(history:{inviteeId:string;status:string}[],targetId:string):boolean {
  // A previously accepted, expired or declined invite is still spent. This
  // mirrors SQL's non-resettable unique (room_id,invitee_id) invariant.
  return qaUuid(targetId)&&!history.some(entry=>entry.inviteeId===targetId);
}
