'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { FriendApiError, friendErrorMessage, friendMutation } from './friend-api';
export function FriendRequest({ targetId }: { targetId: string }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const expired = error instanceof FriendApiError && error.status === 401;
  async function request() {
    if (busy.current || sent || expired) return;
    busy.current = true; setPending(true); setError(undefined);
    try {
      const result = await friendMutation<{ alreadyPending: boolean }>('/api/friends/requests', 'POST', { targetId });
      setSent(true); setMessage(result.alreadyPending ? '이미 보낸 요청이 있습니다. 상대방의 응답을 기다려 주세요.' : '친구 요청을 보냈습니다.');
    } catch (cause) { setError(cause); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="arena-friend-request"><button className="arena-button" disabled={pending || sent || expired} onClick={() => { void request(); }}>{pending ? '요청 중…' : sent ? '요청 보냄' : '친구 요청'}</button>
    <p role="status">{message}</p>{error != null && <p role="alert">{friendErrorMessage(error)}</p>}
    <Link className="arena-text-link" href={expired ? '/login' : '/friends'}>{expired ? '로그인하기' : '친구·받은 요청 확인 ›'}</Link>
  </div>;
}
