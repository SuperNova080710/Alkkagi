'use client';
import { useActionState } from 'react';
import { createRoom, joinRoom } from '@/app/rooms/actions';

export function RoomForms() {
  const [create, createAction, creating] = useActionState(createRoom, { error: '' });
  const [join, joinAction, joining] = useActionState(joinRoom, { error: '' });
  return <div className="arena-room-form-grid">
    <form action={createAction} className="arena-room-entry-card">
      <span className="arena-room-card-mark" aria-hidden="true">01</span>
      <h2>새로운 방 만들기</h2>
      <p>초대 코드 또는 친구 초대로 함께 플레이할 방을 만듭니다.</p>
      <button type="submit" disabled={creating} className="arena-button arena-button--gold">
        {creating ? '방 생성 중…' : '방 만들기'}
      </button>
      {create.error && <p role="alert" className="arena-invite-error">{create.error}</p>}
    </form>
    <form action={joinAction} className="arena-room-entry-card arena-room-entry-card--join">
      <span className="arena-room-card-mark" aria-hidden="true">02</span>
      <h2>초대 코드로 참가</h2>
      <p>친구에게 받은 8자리 코드를 입력해 방으로 이동합니다.</p>
      <label htmlFor="invite">초대 코드</label>
      <input id="invite" name="code" type="text" required maxLength={20}
        autoComplete="off" spellCheck={false} placeholder="ABCDEFGH" className="arena-room-code-input"/>
      <button type="submit" disabled={joining} className="arena-button arena-button--blue">
        {joining ? '방 참가 중…' : '방 참가하기'}
      </button>
      {join.error && <p role="alert" className="arena-invite-error">{join.error}</p>}
    </form>
  </div>;
}
