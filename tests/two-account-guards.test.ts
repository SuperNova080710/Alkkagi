import {describe,expect,it} from 'vitest';
import {
  resolveQaPair,qaPeerAllowed,qaScopeRoom,qaScopeRpcRoom,qaScopeMatch,
  qaReward,qaDmIdentity,qaCanSendDm,qaCanSendInvite,type QaSnapshot,type QaMatch,type QaRoom,type QaRpcRoom,
} from '../src/lib/qa/two-account-guards';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const OUTSIDER='33333333-3333-4333-8333-333333333333';
const ROOM='44444444-4444-4444-8444-444444444444';
const MATCH='55555555-5555-4555-8555-555555555555';
const config=[A,B].join(',');
const pair=resolveQaPair(config,A)!;
const before:QaSnapshot={startedAt:'2026-11-02T01:00:00.000Z',totalXp:100,
  dailyPvp:0,dailyCasualPeer:0};
const room:QaRoom={id:ROOM,owner_id:A,created_at:'2026-11-02T01:01:00.000Z',status:'finished'};
const hostRpc:QaRpcRoom={id:ROOM,status:'waiting',yourSeat:1,players:[{seat:1,nickname:'A'}]};
const aRpc:QaRpcRoom={id:ROOM,status:'finished',yourSeat:1,
  players:[{seat:1,nickname:'A'},{seat:2,nickname:'B'}]};
const bRpc:QaRpcRoom={id:ROOM,status:'finished',yourSeat:2,
  players:[{seat:1,nickname:'A'},{seat:2,nickname:'B'}]};
const pairB=resolveQaPair(config,B)!;
const match:QaMatch={id:MATCH,room_id:ROOM,status:'finished',mode:'casual',
  winner_id:A,player1_id:A,player2_id:B,created_at:'2026-11-02T01:02:00.000Z'};

describe('A/B QA browser guard real behavior (#198)',()=>{
  it('rejects outsiders, malformed UUIDs, duplicate allowlists and wrong role',()=>{
    expect(resolveQaPair(config,A)).toEqual({
      role:'A',userA:A,userB:B,otherUserId:B,
    });
    expect(resolveQaPair(config,B)?.role).toBe('B');
    expect(resolveQaPair(config,OUTSIDER)).toBeNull();
    expect(resolveQaPair([A,A].join(','),A)).toBeNull();
    expect(resolveQaPair([A,OUTSIDER,B].join(','),A)).toBeNull();
    expect(resolveQaPair([A,'not-a-uuid'].join(','),A)).toBeNull();
    expect(resolveQaPair(undefined,A)).toBeNull();
    expect(qaPeerAllowed(A,B,pair)).toBe(true);
    expect(qaPeerAllowed(A,OUTSIDER,pair)).toBe(false);
    expect(qaPeerAllowed(B,A,pair)).toBe(false);
    expect(qaPeerAllowed(B,A,resolveQaPair(config,B)!)).toBe(true);
    expect(qaPeerAllowed(A,A,pair)).toBe(false);
  });

  it('verifies a host with one RPC seat, and a guest with member-only RPC seats',()=>{
    expect(qaScopeRoom(room,pair,before)).toBe(true);
    expect(qaScopeRoom({...room,owner_id:OUTSIDER},pair,before)).toBe(false);
    expect(qaScopeRoom({...room,created_at:'2026-11-01T23:59:00Z'},pair,before)).toBe(false);
    expect(qaScopeRoom(room,pair,null)).toBe(false);
    expect(qaScopeRpcRoom({...room,status:'waiting'},hostRpc,pair,before,A,1)).toBe(true);
    expect(qaScopeRpcRoom(room,aRpc,pair,before,A,2)).toBe(true);
    expect(qaScopeRpcRoom(room,bRpc,pairB,before,B,2)).toBe(true);
    expect(qaScopeRpcRoom(room,aRpc,pair,before,B,2)).toBe(false);
    expect(qaScopeRpcRoom(room,bRpc,pairB,before,OUTSIDER,2)).toBe(false);
    expect(qaScopeRpcRoom(room,{...aRpc,yourSeat:2},pair,before,A,2)).toBe(false);
    expect(qaScopeRpcRoom(room,{...aRpc,players:[{seat:1}]},pair,before,A,2)).toBe(false);
    expect(qaScopeRpcRoom(room,{...aRpc,players:[{seat:1},{seat:1}]},pair,before,A,2)).toBe(false);
    expect(qaScopeRpcRoom(room,{...aRpc,players:[{seat:2},{seat:3}]},pair,before,A,2)).toBe(false);
    expect(qaScopeRpcRoom(room,{...aRpc,id:OUTSIDER},pair,before,A,2)).toBe(false);
    expect(qaScopeRpcRoom(room,{...aRpc,status:'waiting'},pair,before,A,2)).toBe(false);
  });

  it('handles room_players RLS self-only visibility without relying on two SELECT rows',()=>{
    // Real policy room_players_read_self only returns one row to each JWT.
    // The verified get_casual_room RPC is the sole source of both seat numbers.
    const aSelfVisible=[{user_id:A,seat:1}];
    const bSelfVisible=[{user_id:B,seat:2}];
    expect(aSelfVisible).toHaveLength(1);
    expect(bSelfVisible).toHaveLength(1);
    expect(qaScopeRpcRoom(room,aRpc,pair,before,A,2)).toBe(true);
    expect(qaScopeRpcRoom(room,bRpc,pairB,before,B,2)).toBe(true);
    expect(qaScopeRpcRoom(room,{...bRpc,players:bSelfVisible},pairB,before,B,2)).toBe(false);
    expect(qaScopeMatch(match,room,aRpc,pair,before,A)).toBe(true);
    expect(qaScopeMatch(match,room,bRpc,pairB,before,B)).toBe(true);
  });

  it('requires the exact new A/B casual match, owner, winner and fixed room',()=>{
    expect(qaScopeMatch(match,room,aRpc,pair,before,A)).toBe(true);
    expect(qaScopeMatch({...match,player2_id:OUTSIDER},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch({...match,player1_id:B},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch({...match,room_id:OUTSIDER},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch({...match,mode:'ranked'},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch({...match,winner_id:OUTSIDER},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch({...match,status:'active'},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch({...match,created_at:'2026-11-01T23:00:00Z'},room,aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch(match,{...room,owner_id:OUTSIDER},aRpc,pair,before,A)).toBe(false);
    expect(qaScopeMatch(match,room,{...aRpc,players:[{seat:1}]},pair,before,A)).toBe(false);
    expect(qaScopeMatch(match,room,aRpc,pair,null,A)).toBe(false);
  });

  it('classifies capped XP as LIMITED not paid; rejects incorrect ledger amounts',()=>{
    expect(qaReward(before,true,false,40).kind).toBe('awarded');
    expect(qaReward(before,false,false,20).kind).toBe('awarded');
    expect(qaReward(before,false,true,25).kind).toBe('awarded');
    expect(qaReward(before,true,false,0).kind).toBe('invalid');
    for(const cap of [{dailyPvp:20},{dailyCasualPeer:5}]){
      const snapshot={...before,...cap};
      expect(qaReward(snapshot,true,false,0)).toEqual({kind:'capped',expected:40,actual:0});
      expect(qaReward(snapshot,false,false,20).kind).toBe('invalid');
    }
    expect(qaReward(before,true,false,-1).kind).toBe('invalid');
    expect(qaReward(before,true,false,40.5).kind).toBe('invalid');
  });

  it('generates stable pair-only SQL idempotent request IDs across reloads',async()=>{
    const first=await qaDmIdentity(A,B);
    const second=await qaDmIdentity(A,B);
    const stranger=await qaDmIdentity(A,OUTSIDER);
    expect(first).toEqual(second);
    expect(first.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.marker).toBe('ALK-QA-'+first.requestId);
    expect(first.requestId).not.toBe(stranger.requestId);
    await expect(qaDmIdentity(A,A)).rejects.toThrow('INVALID_QA_PAIR');
  });
  it('blocks repeated DM and invite mutations after refresh or an earlier stage',()=>{
    const marker='ALK-QA-11111111-1111-4111-8111-111111111111';
    expect(qaCanSendDm([],marker)).toBe(true);
    expect(qaCanSendDm([{body:'different'}],marker)).toBe(true);
    expect(qaCanSendDm([{body:marker}],marker)).toBe(false);
    expect(qaCanSendDm([], 'wrong-marker')).toBe(false);
    expect(qaCanSendInvite([],B)).toBe(true);
    for(const status of ['pending','accepted','declined','expired']){
      expect(qaCanSendInvite([{inviteeId:B,status}],B)).toBe(false);
    }
    expect(qaCanSendInvite([{inviteeId:OUTSIDER,status:'accepted'}],B)).toBe(true);
    expect(qaCanSendInvite([], 'not-an-id')).toBe(false);
  });

});
