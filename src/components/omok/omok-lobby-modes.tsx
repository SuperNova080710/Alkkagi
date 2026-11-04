'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArenaModeCard } from '@/components/ui/arena';
import { OmokCasualLobby } from '@/components/omok/omok-casual-lobby';

/** Mirrors the Alkkagi mode cards and room dialog without changing Omok APIs. */
export function OmokLobbyModes() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <div className="arena-modes" aria-label="오목 대전 방식">
      <ArenaModeCard mode="casual" game="omok">
        <button className="arena-button" type="button" onClick={() => dialog.current?.showModal()}>
          방 만들기 · 코드로 참가 <span aria-hidden="true">›</span>
        </button>
      </ArenaModeCard>
      <ArenaModeCard mode="ranked" game="omok">
        <Link className="arena-button arena-button--gold" href="/omok/ranked">
          랭크전 시작 <span aria-hidden="true">›</span>
        </Link>
      </ArenaModeCard>
      <ArenaModeCard mode="ai" game="omok">
        <Link className="arena-button arena-button--blue" href="/omok/ai">
          AI 연습 시작 <span aria-hidden="true">›</span>
        </Link>
      </ArenaModeCard>
    </div>
    <dialog className="arena-dialog arena-omok-entry-dialog" ref={dialog}
      aria-labelledby="omok-mode-dialog-title">
      <div className="arena-dialog-heading">
        <h2 id="omok-mode-dialog-title">친구와 오목 한 판!</h2>
        <button type="button" className="arena-close" aria-label="닫기"
          onClick={() => dialog.current?.close()}>×</button>
      </div>
      <OmokCasualLobby />
    </dialog>
  </>;
}
