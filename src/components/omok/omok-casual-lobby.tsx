'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { isRecord, isUuid, omokErrorText, omokRequest } from './omok-client-api';
import './omok-live.css';

export function OmokCasualLobby() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

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
    {error && <p role="alert" className="arena-invite-error">{error}</p>}
  </div>;
}
