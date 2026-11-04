'use client';

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
  return <div className="arena-omok-casual-entry" aria-label="오목 일반전 시작">
    <div className="arena-room-form-grid">
      <form className="arena-room-entry-card" onSubmit={event => {
        event.preventDefault();
        void act('/api/omok/rooms');
      }}>
        <span className="arena-room-card-mark" aria-hidden="true">01</span>
        <h2>새로운 방 만들기</h2>
        <p>초대 코드 또는 친구 초대로 함께 플레이할 오목 방을 만듭니다.</p>
        <button className="arena-button arena-button--gold" type="submit" disabled={pending}>
          {pending ? '방 생성 중…' : '새 방 만들기'}
        </button>
      </form>
      <form className="arena-room-entry-card arena-room-entry-card--join" onSubmit={join}>
        <span className="arena-room-card-mark" aria-hidden="true">02</span>
        <h2>초대 코드로 참가</h2>
        <p>친구에게 받은 8자리 코드를 입력해 방으로 이동합니다.</p>
        <label htmlFor="omok-join-code">초대 코드</label>
        <input id="omok-join-code" name="code" type="text" required maxLength={12}
          value={code} onChange={event => setCode(event.target.value)}
          autoComplete="off" spellCheck={false} placeholder="ABCDEFGH"
          className="arena-room-code-input" disabled={pending}/>
        <button className="arena-button arena-button--blue" type="submit" disabled={pending}>
          {pending ? '방 참가 중…' : '방 참가하기'}
        </button>
      </form>
    </div>
    <p className="arena-muted arena-omok-rules">
      15×15 오목 · 흑돌 선공 · 가로·세로·대각선으로 돌 다섯 개를 먼저 연결하면 승리합니다.
    </p>
    {error && <p role="alert" className="arena-invite-error">{error}</p>}
    {(inviteError || invites.length > 0) && <section className="arena-omok-live-panel arena-omok-dialog-invites"
      aria-label="받은 오목 초대">
      <div className="arena-omok-live-heading">
        <h3>받은 오목 초대 ({invites.length})</h3>
        <button type="button" className="arena-button arena-button--outline"
          disabled={pending} onClick={() => void loadInvites()}>초대 새로고침</button>
      </div>
      {inviteError && <p role="alert" className="arena-omok-live-error">{inviteError}</p>}
      <ul className="arena-omok-live-list">
        {invites.map(invite => <li key={invite.id}>
          <span><strong>{invite.inviterNickname}</strong>님의 초대
            {invite.expiresAt && <small>만료: {new Date(invite.expiresAt).toLocaleTimeString('ko-KR')}</small>}</span>
          <div>
            <button type="button" className="arena-button" disabled={pending}
              onClick={() => void respond(invite, true)}>수락</button>
            <button type="button" className="arena-button arena-button--outline"
              disabled={pending} onClick={() => void respond(invite, false)}>거절</button>
          </div>
        </li>)}
      </ul>
    </section>}
  </div>;
}
