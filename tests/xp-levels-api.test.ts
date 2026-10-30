import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/user',()=>({getVerifiedUser:mock.getUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:mock.client}));
import {GET as me} from '../src/app/api/experience/me/route';
import {GET as other} from '../src/app/api/experience/players/[id]/route';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const origin='https://alkkagi-alpha.vercel.app';
function req(id:string){return new NextRequest(origin+'/api/experience/players/'+id);}
const params=(id:string)=>({params:Promise.resolve({id})});
beforeEach(()=>{
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({id:a});
  mock.client.mockResolvedValue({rpc:mock.rpc});
  mock.rpc.mockResolvedValue({data:{userId:a,totalXp:0,level:1,recentRewards:[]},error:null});
});
describe('XP V1 authenticated API contracts',()=>{
  it('denies unsigned requests before touching XP records',async()=>{
    mock.getUser.mockResolvedValue(null);
    expect((await me()).status).toBe(401);
    expect((await other(req(b),params(b))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('returns own XP using verified token identity, not query actorId',async()=>{
    const r=await me();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('no-store');
    expect(r.headers.get('vary')).toBe('Cookie');
    expect(mock.rpc).toHaveBeenCalledWith('get_player_experience',{p_player_id:a});
    expect((await r.json()).data.totalXp).toBe(0);
  });
  it('validates UUID and obscures private/missing players',async()=>{
    expect((await other(req('invalid'),params('invalid'))).status).toBe(400);
    mock.rpc.mockResolvedValue({data:null,error:null});
    const hidden=await other(req(b),params(b));
    expect(hidden.status).toBe(404);
    expect((await hidden.json()).error).toBe('PLAYER_NOT_FOUND');
    expect(mock.rpc).toHaveBeenCalledWith('get_player_experience',{p_player_id:b});
  });
  it('never leaks SQL errors and handles failures in either endpoint',async()=>{
    mock.rpc.mockResolvedValue({data:null,error:{message:'secret database error'}});
    const self=await me();
    expect(self.status).toBe(503);
    expect(JSON.stringify(await self.json())).not.toContain('secret');
    const player=await other(req(b),params(b));
    expect(player.status).toBe(503);
    expect(JSON.stringify(await player.json())).not.toContain('secret');
    mock.rpc.mockRejectedValue(new Error('secret DB error'));
    expect((await me()).status).toBe(503);
  });
});