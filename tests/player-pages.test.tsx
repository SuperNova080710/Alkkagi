import { beforeEach, describe, expect, it, vi } from 'vitest';
const { requireUser, notFound } = vi.hoisted(() => ({ requireUser: vi.fn(), notFound: vi.fn() }));
vi.mock('@/lib/auth/user', () => ({ requireUser }));
vi.mock('next/navigation', () => ({ notFound }));
import PlayersPage from '../src/app/players/page';
import PlayerPage from '../src/app/players/[id]/page';
import { config } from '../src/proxy';
vi.mock('@supabase/ssr',()=>({createServerClient:vi.fn()}));
vi.mock('../src/lib/supabase/config',()=>({getSupabaseConfig:()=>null}));
beforeEach(()=>{vi.resetAllMocks();requireUser.mockResolvedValue({id:'me'});notFound.mockImplementation(()=>{throw new Error('not found');});});
describe('protected player pages',()=>{
 it('requires authentication before rendering either directory page',async()=>{
  requireUser.mockRejectedValue(new Error('login redirect'));
  await expect(PlayersPage()).rejects.toThrow('login redirect');
  await expect(PlayerPage({params:Promise.resolve({id:'00000000-0000-0000-0000-000000000011'})})).rejects.toThrow('login redirect');
 });
 it('rejects malformed profile ids without rendering the API consumer',async()=>{
  await expect(PlayerPage({params:Promise.resolve({id:'invalid'})})).rejects.toThrow('not found');
  expect(requireUser).toHaveBeenCalledOnce();
 });
 it('includes direct directory navigation in the session refresh matcher',()=>{
  expect(config.matcher).toContain('/players/:path*');
  expect(config.matcher).toContain('/api/players/:path*');
 });
});
