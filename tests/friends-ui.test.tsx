import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FriendApiError, friendActionRequest, friendErrorMessage, friendMutation } from '../src/components/friends/friend-api';
import { FriendsView } from '../src/components/friends/friends-view';
import FriendsPage from '../src/app/friends/page';
const { auth } = vi.hoisted(()=>({auth:vi.fn(async()=>({id:'me'}))}));
vi.mock('@/lib/auth/user',()=>({requireUser:auth}));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
describe('friends UI contract',()=>{
 it('keeps the feature off by default and does not mount the API consumer',async()=>{
  vi.stubEnv('FRIENDS_UI_ENABLED','');
  const html=renderToStaticMarkup(await FriendsPage());
  expect(html).toContain('친구 기능 준비 중');
  expect(html).not.toContain('목록 새로고침');
  expect(auth).toHaveBeenCalledOnce();
 });
 it('requires an explicit true flag to activate the list',async()=>{
  vi.stubEnv('FRIENDS_UI_ENABLED','true');
  const html=renderToStaticMarkup(await FriendsPage());
  expect(html).toContain('목록 새로고침');
  expect(html).toContain('친구 목록을 불러오고');
 });
 it('does not disguise a pending list request as an empty friend list',()=>{
  const html=renderToStaticMarkup(<FriendsView/>);
  expect(html).not.toContain('아직 친구가 없습니다');
  expect(html).not.toContain('친구 (0)');
 });
 it('sends accept/reject to request ids and remove/block to user ids',()=>{
  expect(friendActionRequest({kind:'accept',id:'request-id',nickname:'N'})).toEqual({path:'/api/friends/requests/request-id/respond',method:'POST',body:{accept:true}});
  expect(friendActionRequest({kind:'reject',id:'request-id',nickname:'N'}).body).toEqual({accept:false});
  expect(friendActionRequest({kind:'remove',id:'user-id',nickname:'N'})).toEqual({path:'/api/friends/user-id',method:'DELETE'});
  expect(friendActionRequest({kind:'block',id:'user-id',nickname:'N'})).toEqual({path:'/api/friends/blocks/user-id',method:'PUT',body:{blocked:true}});
  expect(friendActionRequest({kind:'unblock',id:'user-id',nickname:'N'}).body).toEqual({blocked:false});
 });
 it('uses neutral unavailability copy and does not expose arbitrary API errors',()=>{
  expect(friendErrorMessage(new FriendApiError(404,'FRIEND_NOT_AVAILABLE'))).toBe('지금은 이 플레이어에게 요청할 수 없습니다.');
  expect(friendErrorMessage(new FriendApiError(500,'secret SQL message'))).not.toContain('secret SQL');
  expect(friendErrorMessage(new FriendApiError(409,'INCOMING_FRIEND_REQUEST'))).toContain('받은 요청');
  expect(friendErrorMessage(new FriendApiError(409,'FRIEND_REQUEST_COOLDOWN'))).toContain('24시간');
 });
 it('preserves JSON mutation contract and same-origin cookies',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{alreadyPending:true}})});vi.stubGlobal('fetch',fetcher);
  await expect(friendMutation('/api/friends/requests','POST',{targetId:'target'})).resolves.toEqual({alreadyPending:true});
  expect(fetcher).toHaveBeenCalledWith('/api/friends/requests',expect.objectContaining({method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{"targetId":"target"}'}));
 });
 it('handles non-JSON service errors without returning success',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>{throw Error('html');}}));
  await expect(friendMutation('/api/friends/user','DELETE')).rejects.toMatchObject({status:503,code:'UNKNOWN'});
 });
});
