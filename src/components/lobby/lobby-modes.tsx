'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { createRoom } from '@/app/rooms/actions';
import { RoomForms } from '@/components/rooms/room-forms';
import { ArenaModeCard } from '@/components/ui/arena';

/** UI only: existing room actions remain the source of truth. */
export function LobbyModes() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'casual' | 'ai'>('casual');
  const [state, action, pending] = useActionState(createRoom, { error: '' });
  function busy() {
    return pending || Boolean(dialog.current?.querySelector('button[type="submit"]:disabled, form button:not([type]):disabled'));
  }
  function open(next: 'casual' | 'ai') {
    setMode(next);
    dialog.current?.showModal();
  }
  return <>
    <div className="arena-modes">
      <ArenaModeCard mode="casual"><button type="button" className="arena-button" onClick={() => open('casual')}>방 만들기 · 코드로 참가 <span aria-hidden="true">›</span></button></ArenaModeCard>
      <ArenaModeCard mode="ranked"><Link href="/ranked" className="arena-button arena-button--gold">랭크전 시작 <span aria-hidden="true">›</span></Link></ArenaModeCard>
      <ArenaModeCard mode="ai"><button type="button" className="arena-button arena-button--blue" onClick={() => open('ai')}>AI 연습방 만들기 <span aria-hidden="true">›</span></button></ArenaModeCard>
    </div>
    <dialog ref={dialog} className="arena-dialog" aria-labelledby="mode-dialog-title" onCancel={event => { if (busy()) event.preventDefault(); }}>
      <div className="arena-dialog-heading">
        <h2 id="mode-dialog-title">{mode === 'casual' ? '친구와 한 판!' : 'AI와 연습해 볼까요?'}</h2>
        <button type="button" className="arena-close" aria-label="닫기" disabled={pending} onClick={() => { if (!busy()) dialog.current?.close(); }}>×</button>
      </div>
      {mode === 'casual' ? <RoomForms /> : <form action={action} className="arena-ai-entry">
        <p>연습방을 만든 뒤, 대기실에서 <strong>AI 상대 추가</strong>를 누르고 난이도를 선택해 주세요.</p>
        <p className="arena-muted">AI 대전은 랭크 RP에 영향을 주지 않습니다.</p>
        <button className="arena-button arena-button--blue" disabled={pending}>{pending ? '연습방 만드는 중…' : '연습방 만들기'}</button>
        {state.error && <p role="alert">{state.error}</p>}
      </form>}
    </dialog>
  </>;
}
