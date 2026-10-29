import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/user',()=>({getVerifiedUser:mock.getUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:mock.client}));

import {GET as mine} from '../src/app/api/cosmetics/me/route';
import {PUT as equip} from '../src/app/api/cosmetics/equip/route';
import {GET as publicLoadout} from '../src/app/api/cosmetics/players/[id]/route';
import {validEquipCosmetic} from '../src/lib/cosmetics/validation';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const host='https://alkkagi-alpha.vercel.app';
const params=(id:string)=>({params:Promise.resolve({id})});
const get=(id:string)=>new NextRequest(host+'/api/cosmetics/players/'+id);
function put(body:unknown,origin=host){
  return new NextRequest(host+'/api/cosmetics/equip',{
    method:'PUT',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)
  });
}
beforeEach(()=>{
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({id:a});
  mock.client.mockResolvedValue({rpc:mock.rpc});
  mock.rpc.mockResolvedValue({data:{loadout:{pieceCode:'piece-classic',avatarCode:'avatar-classic'},items:[]},error:null});
});
describe('Cosmetic V1 authenticated HTTP contract',()=>{
  it('accepts only exact item code schema and rejects spoofed owner fields',()=>{
    expect(validEquipCosmetic({itemCode:'piece-classic'})).toBe(true);
    expect(validEquipCosmetic({itemCode:'avatar-orbit'})).toBe(true);
    expect(validEquipCosmetic({itemCode:'piece-classic',userId:b})).toBe(false);
    expect(validEquipCosmetic({itemCode:'unexpected item'})).toBe(false);
    expect(validEquipCosmetic({itemCode:1})).toBe(false);
    expect(validEquipCosmetic(['piece-classic'])).toBe(false);
  });
  it('rejects every anonymous route before RPC access',async()=>{
    mock.getUser.mockResolvedValue(null);
    expect((await mine()).status).toBe(401);
    expect((await publicLoadout(get(b),params(b))).status).toBe(401);
    expect((await equip(put({itemCode:'piece-classic'}))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('fetches personal inventory and returns private cache headers',async()=>{
    const r=await mine();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('no-store');
    expect(r.headers.get('vary')).toBe('Cookie');
    expect(mock.rpc).toHaveBeenCalledWith('get_my_cosmetics');
    expect((await r.json()).data.loadout.pieceCode).toBe('piece-classic');
  });
  it('rejects invalid body, too-large payload and cross-origin equip requests',async()=>{
    expect((await equip(put({itemCode:'piece-classic'},'https://attacker.invalid'))).status).toBe(403);
    expect((await equip(put({itemCode:'piece-classic',userId:b}))).status).toBe(400);
    expect((await equip(put({itemCode:'piece-classic',junk:'a'.repeat(3000)}))).status).toBe(400);
    expect((await equip(put({itemCode:'piece-unknown'}))).status).toBe(503);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    // Schema-valid but unknown item must be rejected by the guarded SQL RPC.
    expect(mock.rpc).toHaveBeenCalledWith('equip_my_cosmetic',{p_item_code:'piece-unknown'});
  });
  it('equips a validated code and accepts only the server-returned loadout',async()=>{
    mock.rpc.mockResolvedValue({data:{pieceCode:'piece-forest',avatarCode:'avatar-classic'},error:null});
    const r=await equip(put({itemCode:'piece-forest'}));
    expect(r.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('equip_my_cosmetic',{p_item_code:'piece-forest'});
    expect((await r.json()).data.pieceCode).toBe('piece-forest');
  });
  it('returns public equip codes but not other users owned items',async()=>{
    mock.rpc.mockResolvedValue({data:{userId:b,pieceCode:'piece-classic',avatarCode:'avatar-bronze'},error:null});
    const r=await publicLoadout(get(b),params(b));
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({userId:b,pieceCode:'piece-classic',avatarCode:'avatar-bronze'});
    expect(mock.rpc).toHaveBeenCalledWith('get_public_player_cosmetics',{p_player_id:b});
    expect((await publicLoadout(get('bad'),params('bad'))).status).toBe(400);
    mock.rpc.mockResolvedValue({data:null,error:null});
    expect((await publicLoadout(get(b),params(b))).status).toBe(404);
  });
  it('maps only known SQL errors and never reveals database internals',async()=>{
    mock.rpc.mockResolvedValue({data:null,error:{message:'COSMETIC_LOCKED'}});
    const locked=await equip(put({itemCode:'avatar-orbit'}));
    expect(locked.status).toBe(409);
    expect((await locked.json()).error).toBe('COSMETIC_LOCKED');
    mock.rpc.mockResolvedValue({data:null,error:{message:'private database secret text'}});
    const internal=await equip(put({itemCode:'avatar-orbit'}));
    expect(internal.status).toBe(503);
    expect(JSON.stringify(await internal.json())).not.toContain('secret');
    expect((await mine()).status).toBe(503);
  });
});