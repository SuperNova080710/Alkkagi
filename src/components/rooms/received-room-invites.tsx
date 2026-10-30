'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { usePlayerResource } from '@/components/players/use-player-resource';
import {
  inviteTime, isRoomUuid, RoomInviteError, roomInviteError, roomInviteMutation,
  type ReceivedRoomInvite, type RoomInviteResponded,
} from './room-invite-api';

export function ReceivedRoomInvites() {
  const router = useRouter();
  const { data, error, loading, retry } =
    usePlayerResource<ReceivedRoomInvite[]>('/api/room-invites');
  const [processing, setProcessing] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const focus = () => retry();
    const visibility = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [retry]);

  async function respond(inviteId: string, accept: boolean) {
    if (inFlight.current || !isRoomUuid(inviteId)) return;
    inFlight.current = true;
    setProcessing(inviteId); setNotice(''); setFailure(null);
    try {
      const result = await roomInviteMutation<RoomInviteResponded>(
        '/api/room-invites/' + encodeURIComponent(inviteId) + '/respond', { accept },
      );
      if (accept && result.status === 'accepted' && isRoomUuid(result.roomId)) {
        router.push('/rooms/' + result.roomId);
        router.refresh();
      } else if (!accept && result.status === 'declined') {
        setNotice('대전 초대를 거절했습니다.');
      } else {
        throw new RoomInviteError(503, 'ROOM_INVITE_SERVICE_UNAVAILABLE');
      }
      retry();
    } catch (cause) {
      setFailure(cause); retry();
    } finally {
      inFlight.current = false; setProcessing(null);
    }
  }

  const received = Array.isArray(data) ? data : [];
  return <section className="arena-panel arena-received-invites" aria-labelledby="received-invites-title">
    <div className="arena-received-heading">
      <h2 id="received-invites-title">받은 대전 초대 ({received.length})</h2>
      <button type="button" className="arena-button arena-button--outline"
        onClick={retry} disabled={loading || processing !== null}>새로고침</button>
    </div>
    <p className="arena-muted">친구가 보낸 일반전 초대는 5분 동안 유효합니다. 수락하면 해당 방에 입장합니다.</p>
    {loading && <p role="status" className="arena-muted">초대 목록을 확인하는 중…</p>}
    {error != null && <div role="alert" className="arena-invite-error">
      {error === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' :
        error === 503 ? '초대 기능을 이용할 수 없습니다. 운영 준비 상태를 확인해 주세요.' :
          '초대 목록을 불러오지 못했습니다.'}
      {error === 401 ? <Link href="/login">로그인하기</Link> :
        <button type="button" onClick={retry}>다시 조회</button>}
    </div>}
    {!loading && error == null && !received.length &&
      <p className="arena-received-empty">지금 받은 대전 초대가 없습니다.</p>}
    <ul className="arena-received-list">
      {received.filter(invite => isRoomUuid(invite.id) && isRoomUuid(invite.roomId)).map(invite =>
        <li key={invite.id}>
          <div><strong>{invite.inviterNickname || '친구'}</strong>
            <span>함께 일반전 한 판!</span>
            <time dateTime={invite.expiresAt}>만료 {inviteTime(invite.expiresAt)}</time>
          </div>
          <div className="arena-received-actions">
            <button type="button" className="arena-button arena-button--gold"
              disabled={processing !== null} onClick={() => void respond(invite.id, true)}>
              {processing === invite.id ? '처리 중…' : '수락'}
            </button>
            <button type="button" className="arena-button arena-button--outline"
              disabled={processing !== null} onClick={() => void respond(invite.id, false)}>
              거절
            </button>
          </div>
        </li>)}
    </ul>
    {failure != null && <p role="alert" className="arena-invite-error">{roomInviteError(failure)}</p>}
    <p role="status" className="arena-invite-feedback">{notice}</p>
  </section>;
}
