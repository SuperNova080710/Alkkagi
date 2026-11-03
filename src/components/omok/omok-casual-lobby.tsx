'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { isRecord, isUuid, omokErrorText, omokRequest } from './omok-client-api';
import './omok-live.css';

type Invite = { id: string; roomId: string; inviterNickname: string; expiresAt: string };
function parseInvites(raw: unknown): Invite[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).filter(v => isUuid(v.id) && isUuid(v.roomId))
    .map(v => ({
      id: v.id as string, roomId: v.roomId as string,
      inviterNickname: typeof v.inviterNickname === 'string' ? v.inviterNickname : '친구',
      expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt : '',
    }));
}
export function OmokCasualLobby() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteError, setInviteError] = useState('');
  const busy = useRef(false);
  const loadInvites = useCallback(async () => {
    try {
      const data = await omokRequest<unknown>('/api/omok/invites');
      setInvites(parseInvites(data)); setInviteError('');
    } catch (cause) {
      setInviteError(omokErrorText(cause));
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => { void loadInvites(); });
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadInvites();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [loadInvites]);

  async function act(path: string, body?: unknown) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const response = await omokRequest<unknown>(path, { method: 'POST', body });
      if (!isRecord(response) || !isUuid(response.roomId)) throw Error('INVALID_ROOM_RESPONSE');
      router.push('/omok/rooms/' + response.roomId);
    } catch (cause) {
      setError(omokErrorText(cause));
    } finally { setPending(false); busy.current = false; }
  }
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized)) {
      setError('방 코드는 숫자와 영문 8자리입니다.'); return;
    }
    void act('/api/omok/rooms/join', { code: normalized });
  }
  async function respond(invite: Invite, accept: boolean) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const value = await omokRequest<unknown>('/api/omok/invites/' + invite.id + '/respond', {
        method: 'POST', body: { accept },
      });
      if (accept && isRecord(value) && isUuid(value.roomId)) {
        router.push('/omok/rooms/' + value.roomId);
      } else {
        await loadInvites();
      }
    } catch (cause) {
      setError(omokErrorText(cause));
      await loadInvites();
    } finally { busy.current = false; setPending(false); }
  }
  return <section className="arena-omok-live-panel" aria-label="오목 일반전 시작">
    <div className="arena-omok-live-heading">
      <div><h2>친구와 일반전</h2><p>방을 만들거나 받은 코드로 참가하세요.</p></div>
      <Link href="/friends" className="arena-button arena-button--outline">친구 관리</Link>
    </div>
    <div className="arena-omok-live-actions">
      <button type="button" disabled={pending} className="arena-button"
        onClick={() => void act('/api/omok/rooms')}>{pending ? '처리 중…' : '새 방 만들기'}</button>
      <form onSubmit={join}>
        <label htmlFor="omok-join-code">8자리 방 코드</label>
        <input id="omok-join-code" maxLength={12} value={code}
          onChange={event => setCode(event.target.value)} autoComplete="off"
          placeholder="예: ABCD2345" disabled={pending}/>
        <button className="arena-button arena-button--outline" disabled={pending} type="submit">코드로 참가</button>
      </form>
    </div>
    {error && <p role="alert" className="arena-omok-live-error">{error}</p>}
    <div className="arena-omok-live-heading">
      <h3>받은 오목 초대 ({invites.length})</h3>
      <button type="button" className="arena-button arena-button--outline"
        disabled={pending} onClick={() => void loadInvites()}>초대 새로고침</button>
    </div>
    {inviteError && <p role="alert" className="arena-omok-live-error">{inviteError}</p>}
    {!inviteError && invites.length === 0 && <p className="arena-omok-panel-hint">현재 받은 초대가 없습니다.</p>}
    <ul className="arena-omok-live-list">
      {invites.map(invite => <li key={invite.id}>
        <span><strong>{invite.inviterNickname}</strong>님의 초대
          {invite.expiresAt && <small>만료: {new Date(invite.expiresAt).toLocaleTimeString('ko-KR')}</small>}</span>
        <div><button type="button" className="arena-button" disabled={pending}
          onClick={() => void respond(invite, true)}>수락</button>
          <button type="button" className="arena-button arena-button--outline" disabled={pending}
            onClick={() => void respond(invite, false)}>거절</button></div>
      </li>)}
    </ul>
  </section>;
}
