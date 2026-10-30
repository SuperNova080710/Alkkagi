'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePlayerResource } from '@/components/players/use-player-resource';
import { inviteTime, isRoomUuid, roomInviteError, roomInviteMutation,
  validInviteFriends, validSentRoomInvites, type RoomInviteSent,
} from './room-invite-api';

/** Only mounted by a server-verified host of a waiting, unfilled casual room. */
export function SendFriendRoomInvite({ roomId }: { roomId: string }) {
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState<unknown>(null);
  const { data: friends, error: friendsError, loading: friendsLoading, retry: retryFriends } =
    usePlayerResource<unknown>('/api/friends');
  const { data: sent, error: sentError, loading: sentLoading, retry: retrySent } =
    usePlayerResource<unknown>(isRoomUuid(roomId)
      ? '/api/room-invites/sent?roomId=' + encodeURIComponent(roomId) : null);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') retrySent(); };
    const focus = () => retrySent();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', refresh); };
  }, [retrySent]);

  const invitees = validInviteFriends(friends);
  const sentList = validSentRoomInvites(sent);

  async function send() {
    if (busy.current || !isRoomUuid(roomId) || !isRoomUuid(selected) ||
        !invitees.some(friend => friend.id === selected)) return;
    busy.current = true; setPending(true); setFeedback(''); setFailure(null);
    try {
      const result = await roomInviteMutation<RoomInviteSent>('/api/room-invites', {
        roomId, targetId: selected,
      });
      setFeedback(result.alreadyPending ? '이미 초대가 발송되어 있습니다.' : '친구에게 초대를 보냈습니다. 5분 안에 수락할 수 있습니다.');
      retrySent();
    } catch (error) {
      setFailure(error); retrySent(); retryFriends();
    } finally {
      busy.current = false; setPending(false);
    }
  }
  return <section className="arena-wait-invites" aria-label="친구 초대">
    <div className="arena-wait-invites-head">
      <div><h3>친구에게 대전 초대</h3><p>친구가 수락하면 이 방의 두 번째 자리에 입장합니다.</p></div>
      <Link href="/friends" className="arena-button arena-button--outline">친구 관리</Link>
    </div>
    <div className="arena-invite-send">
      <label htmlFor="room-invite-target">초대할 친구</label>
      <select id="room-invite-target" value={selected} onChange={e => setSelected(e.target.value)}
        disabled={pending || friendsLoading || !!friendsError} >
        <option value="">친구를 선택해 주세요</option>
        {invitees.map(friend => <option value={friend.id} key={friend.id}>{friend.nickname}</option>)}
      </select>
      <button className="arena-button arena-button--gold" type="button"
        disabled={pending || !isRoomUuid(selected) || !invitees.some(friend => friend.id === selected)}
        onClick={() => void send()}>{pending ? '발송 중…' : '초대 보내기'}</button>
    </div>
    {friendsLoading && <p role="status" className="arena-muted">친구 목록을 불러오는 중…</p>}
    {!friendsLoading && !friendsError && !invitees.length &&
      <p className="arena-muted">초대할 친구가 없습니다. 먼저 친구 요청을 보내고 수락받아 주세요.</p>}
    {friendsError != null && <p role="alert" className="arena-invite-error">친구 목록을 불러올 수 없습니다.
      <button type="button" onClick={retryFriends}>다시 조회</button></p>}
    {failure != null && <p role="alert" className="arena-invite-error">{roomInviteError(failure)}</p>}
    <p role="status" className="arena-invite-feedback">{feedback}</p>
    <div className="arena-invite-sent-head">
      <strong>보낸 초대</strong>
      <button className="arena-button arena-button--outline" type="button" onClick={retrySent}
        disabled={sentLoading}>목록 새로고침</button>
    </div>
    {sentLoading && <p role="status" className="arena-muted">발송 상태 확인 중…</p>}
    {sentError != null && <p role="alert" className="arena-invite-error">{sentError === 401
      ? '로그인 세션이 만료되었습니다.' : '보낸 초대 목록을 확인할 수 없습니다.'}</p>}
    {!sentLoading && sentError == null && !sentList.length &&
      <p className="arena-muted">아직 이 방에서 보낸 초대가 없습니다.</p>}
    <ul className="arena-invite-sent-list">
      {sentList.map(invite => <li key={invite.id}>
        <span><strong>{invite.inviteeNickname ?? '친구'}</strong>
          <small>만료 {inviteTime(invite.expiresAt)}</small></span>
        <span className="arena-invite-status">{invite.status === 'pending' ? '응답 대기' :
          invite.status === 'accepted' ? '수락' :
          invite.status === 'declined' ? '거절' : '만료'}</span>
      </li>)}
    </ul>
  </section>;
}
