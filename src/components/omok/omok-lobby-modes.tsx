'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArenaModeCard } from '@/components/ui/arena';
import { OmokCasualLobby } from '@/components/omok/omok-casual-lobby';
import { OmokAiModalEntry } from '@/components/omok/omok-ai-modal-entry';

/** Both Omok entry modes reuse the Alkkagi ArenaDialog layout. */
export function OmokLobbyModes() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'casual' | 'ai'>('casual');
  const [aiPending, setAiPending] = useState(false);

  function open(next: 'casual' | 'ai') {
    setMode(next);
    dialog.current?.showModal();
  }

  return <>
    <div className="arena-modes" aria-label="오목 대전 방식">
      <ArenaModeCard mode="casual" game="omok">
        <button className="arena-button" type="button" onClick={() => open('casual')}>
          방 만들기 · 코드로 참가 <span aria-hidden="true">›</span>
        </button>
      </ArenaModeCard>
      <ArenaModeCard mode="ranked" game="omok">
        <Link className="arena-button arena-button--gold" href="/omok/ranked">
          랭크전 시작 <span aria-hidden="true">›</span>
        </Link>
      </ArenaModeCard>
      <ArenaModeCard mode="ai" game="omok">
        <button className="arena-button arena-button--blue" type="button" onClick={() => open('ai')}>
          AI 연습 시작 <span aria-hidden="true">›</span>
        </button>
      </ArenaModeCard>
    </div>
    <dialog className="arena-dialog" ref={dialog} aria-labelledby="omok-mode-dialog-title"
      onCancel={event => { if (aiPending) event.preventDefault(); }}>
      <div className="arena-dialog-heading">
        <h2 id="omok-mode-dialog-title">{mode === 'casual' ? '친구와 한 판!' : 'AI와 연습해 볼까요?'}</h2>
        <button type="button" className="arena-close" aria-label="닫기" disabled={aiPending}
          onClick={() => { if (!aiPending) dialog.current?.close(); }}>×</button>
      </div>
      {mode === 'casual' ? <OmokCasualLobby/> :
        <OmokAiModalEntry onPendingChange={setAiPending}/>}
    </dialog>
  </>;
}
