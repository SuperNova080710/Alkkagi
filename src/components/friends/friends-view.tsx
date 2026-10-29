'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArenaPanel } from '@/components/ui/arena';
import { usePlayerResource } from '@/components/players/use-player-resource';
import { FriendApiError, friendActionRequest, friendErrorMessage, friendMutation, type FriendAction } from './friend-api';
type Person = { id: string; nickname: string };
type Request = { id: string; userId: string; nickname: string; createdAt: string };
export type FriendsData = { friends: Person[]; incoming: Request[]; outgoing: Request[]; blocked: { id: string; nickname: string | null }[] };
const labels = { accept: '수락', reject: '거절', remove: '친구 해제', block: '차단', unblock: '차단 해제' };
const details = {
  accept: '수락하면 서로 친구 목록에 추가됩니다.', reject: '거절하면 이 요청은 종료됩니다. 상대는 24시간 뒤 다시 요청할 수 있습니다.',
  remove: '친구 관계를 해제합니다. 다시 친구가 되려면 새 요청과 수락이 필요합니다.',
  block: '친구 관계와 대기 요청이 해제되고 서로 새 친구 요청을 보낼 수 없게 됩니다. 기존 거절 요청의 대기 시간은 유지됩니다.',
  unblock: '차단만 해제합니다. 이전 친구 관계와 요청은 자동 복구되지 않습니다.',
};
export function FriendsView() {
  const { data, error: loadError, loading, retry } = usePlayerResource<FriendsData>('/api/friends');
  const [action, setAction] = useState<FriendAction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  function choose(next: FriendAction) { setAction(next); setError(undefined); dialog.current?.showModal(); }
  async function confirm() {
    if (!action || busy.current) return;
    busy.current = true; setPending(true); setError(undefined); setMessage('');
    try {
      const request = friendActionRequest(action);
      await friendMutation(request.path, request.method, request.body);
      dialog.current?.close(); setAction(null); setMessage(`${labels[action.kind]} 요청을 처리했습니다. 최신 목록을 확인해 주세요.`); retry();
    } catch (cause) {
      if (cause instanceof FriendApiError && cause.status === 401) { dialog.current?.close(); setAction(null); setExpired(true); }
      else setError(cause);
    } finally { busy.current = false; setPending(false); }
  }
  if (expired || loadError === 401) return <ArenaPanel title="로그인이 필요합니다"><p role="alert">로그인 세션이 만료되었습니다. 다시 로그인해 주세요.</p><Link href="/login" className="arena-button">로그인하기</Link></ArenaPanel>;
  return <>
    <div className="arena-friends-toolbar"><Link href="/players" className="arena-button">플레이어 찾아보기 ›</Link><button className="arena-button arena-button--outline" disabled={loading || pending} onClick={() => { setMessage(''); retry(); }}>목록 새로고침</button></div>
    <p role="status" className="arena-directory-status">{loading ? '친구 목록을 불러오고 있어요…' : message}</p>
    {loadError && <div className="arena-directory-feedback"><p role="alert">친구 목록을 불러오지 못했습니다. 기능 준비 중이거나 일시적인 오류일 수 있습니다.</p><button className="arena-button" onClick={retry}>다시 시도</button></div>}
    {data && <div className="arena-friends-grid">
      <ArenaPanel title={`친구 (${data.friends.length})`}><ul className="arena-friends-list">{data.friends.map(person => <li key={person.id}><Link className="arena-friend-name" href={`/players/${person.id}`}>{person.nickname}</Link><div className="arena-friend-actions"><button onClick={() => choose({ kind: 'remove', ...person })}>친구 해제</button><button onClick={() => choose({ kind: 'block', ...person })}>차단</button></div></li>)}</ul>{!data.friends.length && <p className="arena-muted">아직 친구가 없습니다. 플레이어를 찾아 요청을 보내 보세요.</p>}</ArenaPanel>
      <ArenaPanel title={`받은 요청 (${data.incoming.length})`}><ul className="arena-friends-list">{data.incoming.map(request => <li key={request.id}><Link className="arena-friend-name" href={`/players/${request.userId}`}>{request.nickname}</Link><div className="arena-friend-actions"><button onClick={() => choose({ kind: 'accept', id: request.id, nickname: request.nickname })}>수락</button><button onClick={() => choose({ kind: 'reject', id: request.id, nickname: request.nickname })}>거절</button></div></li>)}</ul>{!data.incoming.length && <p className="arena-muted">받은 친구 요청이 없습니다.</p>}</ArenaPanel>
      <ArenaPanel title={`보낸 요청 (${data.outgoing.length})`}><ul className="arena-friends-list">{data.outgoing.map(request => <li key={request.id}><Link className="arena-friend-name" href={`/players/${request.userId}`}>{request.nickname}</Link><span className="arena-friend-badge">응답 기다리는 중</span></li>)}</ul>{!data.outgoing.length && <p className="arena-muted">보낸 친구 요청이 없습니다.</p>}</ArenaPanel>
      <ArenaPanel title={`차단한 플레이어 (${data.blocked.length})`}><ul className="arena-friends-list">{data.blocked.map(person => <li key={person.id}><strong className="arena-friend-name">{person.nickname ?? '비공개 플레이어'}</strong><div className="arena-friend-actions"><button onClick={() => choose({ kind: 'unblock', id: person.id, nickname: person.nickname ?? '비공개 플레이어' })}>차단 해제</button></div></li>)}</ul>{!data.blocked.length && <p className="arena-muted">차단한 플레이어가 없습니다.</p>}<p className="arena-muted">차단을 해제해도 친구 관계가 자동으로 복구되지는 않습니다.</p></ArenaPanel>
    </div>}
    <dialog className="arena-friend-dialog" ref={dialog} aria-labelledby="friend-action-title" onCancel={event => { if (busy.current) event.preventDefault(); }} onClose={() => { if (!busy.current) setAction(null); }}>
      <h2 id="friend-action-title">{action ? labels[action.kind] : '친구 관리'} 확인</h2><p className="arena-friend-dialog-name">{action?.nickname}</p><p>{action && details[action.kind]}</p>
      {error != null && <p role="alert" className="arena-directory-feedback">{friendErrorMessage(error)}</p>}
      <div className="arena-friend-actions"><button className="arena-button arena-button--outline" disabled={pending} onClick={() => dialog.current?.close()}>취소</button><button className="arena-button" disabled={pending} onClick={() => { void confirm(); }}>{pending ? '처리 중…' : '확인'}</button></div>
    </dialog>
  </>;
}
