'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArenaModeCard } from '@/components/ui/arena';
import { OmokCasualLobby } from './omok-casual-lobby';

/** Reuses the Alkkagi lobby's three mode cards and dialog interaction pattern. */
export function OmokLobbyModes() {
  const dialog = useRef<HTMLDialogElement>(null);

  return <>
    <section className="arena-modes" aria-label="오목 대전 방식">
      <ArenaModeCard mode="casual">
        <button type="button" className="arena-button"
          onClick={() => dialog.current?.showModal()}>
          방 만들기 · 코드로 참가 <span aria-hidden="true">›</span>
        </button>
      </ArenaModeCard>
      <ArenaModeCard mode="ranked">
        <Link href="/omok/ranked" className="arena-button arena-button--gold">
          오목 랭크전 시작 <span aria-hidden="true">›</span>
        </Link>
      </ArenaModeCard>
      <ArenaModeCard mode="ai">
        <Link href="/omok/ai" className="arena-button arena-button--blue">
          AI 오목 연습 <span aria-hidden="true">›</span>
        </Link>
      </ArenaModeCard>
    </section>
    <dialog ref={dialog} className="arena-dialog arena-omok-entry-dialog" aria-labelledby="omok-mode-dialog-title">
      <div className="arena-dialog-heading">
        <h2 id="omok-mode-dialog-title">오목 일반전 시작하기</h2>
        <button type="button" className="arena-close" aria-label="닫기"
          onClick={() => dialog.current?.close()}>×</button>
      </div>
      <OmokCasualLobby />
    </dialog>
  </>;
}
