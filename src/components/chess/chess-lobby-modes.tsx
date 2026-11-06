'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { ReceivedRoomInvites } from '@/components/rooms/received-room-invites';
import { ArenaModeCard } from '@/components/ui/arena';
import { ChessDifficultyForm } from './chess-difficulty-form';
import { chessRequest } from './client';

export function ChessLobbyModes({ invitesEnabled }: { invitesEnabled: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'casual' | 'ai' | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | 'invite' | null>(null);
  const lock = useRef(false);
  const creation = useRef<string | null>(null);

  function open(next: 'casual' | 'ai') {
    setMode(next);
    setError('');
    dialog.current?.showModal();
  }

  async function enter(event: FormEvent, action: 'create' | 'join') {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(action);
    setError('');
    try {
      const body = action === 'create'
        ? { action, requestId: creation.current ??= crypto.randomUUID() }
        : { action, code };
      const { roomId } = await chessRequest<{ roomId: string }>('/rooms', body);
      creation.current = null;
      dialog.current?.close();
      router.push('/chess/rooms/' + roomId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '방에 연결하지 못했습니다.');
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  return <>
    <div className="arena-modes" aria-label="체스 대전 방식">
      <ArenaModeCard game="chess" mode="casual">
        <button className="arena-button" type="button" onClick={() => open('casual')}>
          방 만들기 · 코드로 참가 <span aria-hidden="true">›</span>
        </button>
      </ArenaModeCard>
      <ArenaModeCard game="chess" mode="ranked">
        <Link href="/chess/ranked" className="arena-button arena-button--gold">
          랭크전 시작 <span aria-hidden="true">›</span>
        </Link>
      </ArenaModeCard>
      <ArenaModeCard game="chess" mode="ai">
        <button className="arena-button arena-button--blue" type="button" onClick={() => open('ai')}>
          AI 연습 시작 <span aria-hidden="true">›</span>
        </button>
      </ArenaModeCard>
    </div>
    <dialog ref={dialog} className="arena-dialog" aria-labelledby="chess-mode-title"
      onCancel={event => { if (lock.current) event.preventDefault(); }} onClose={() => setMode(null)}>
      <div className="arena-dialog-heading">
        <h2 id="chess-mode-title">{mode === 'casual' ? '친구와 한 판!' : 'AI와 연습해 볼까요?'}</h2>
        <button type="button" className="arena-close" aria-label="닫기" disabled={pending !== null}
          onClick={() => dialog.current?.close()}>×</button>
      </div>
      {mode === 'casual' ? <div className="chess-casual-entry">
        <div className="arena-room-form-grid">
          <form className="arena-room-entry-card" onSubmit={event => void enter(event, 'create')}>
            <span className="arena-room-card-mark" aria-hidden="true">01</span>
            <h2>새로운 방 만들기</h2>
            <p>{invitesEnabled ? '초대 코드 또는 친구 초대로 체스 대국을 시작합니다.' : '초대 코드로 함께 플레이할 체스 방을 만듭니다.'}</p>
            <button className="arena-button arena-button--gold" type="submit" disabled={pending !== null}>
              {pending === 'create' ? '방 생성 중…' : '새 방 만들기'}
            </button>
          </form>
          <form className="arena-room-entry-card arena-room-entry-card--join" onSubmit={event => void enter(event, 'join')}>
            <span className="arena-room-card-mark" aria-hidden="true">02</span>
            <h2>초대 코드로 참가</h2>
            <p>친구에게 받은 8자리 코드를 입력해 방으로 이동합니다.</p>
            <label htmlFor="chess-join-code">초대 코드</label>
            <input id="chess-join-code" name="code" required maxLength={12} value={code}
              onChange={event => setCode(event.target.value)} autoComplete="off" spellCheck={false}
              placeholder="ABCDEFGH" className="arena-room-code-input" disabled={pending !== null}/>
            <button className="arena-button arena-button--blue" type="submit" disabled={pending !== null}>
              {pending === 'join' ? '방 참가 중…' : '방 참가하기'}
            </button>
          </form>
        </div>
        {error && <p role="alert" className="arena-invite-error">{error}</p>}
        {invitesEnabled && <ReceivedRoomInvites game="chess" disabled={pending === 'create' || pending === 'join'}
          onProcessingChange={processing => {
            lock.current = processing;
            setPending(processing ? 'invite' : null);
          }} onAccepted={() => dialog.current?.close()}/>}
      </div> : mode === 'ai' && <ChessDifficultyForm onStart={difficulty => {
        dialog.current?.close();
        router.push('/chess/ai#' + difficulty);
      }}>
        <Link href="/chess/ai" className="arena-text-link" onClick={() => dialog.current?.close()}>저장된 연습 확인</Link>
      </ChessDifficultyForm>}
    </dialog>
  </>;
}
