'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { OmokBoardView, type OmokPosition, type OmokStone } from './omok-board-view';
import { OmokResultOverlay } from './omok-result-overlay';
import './omok-parity.css';
import './omok-match-panels.css';

export type OmokParticipant = { id: string; nickname: string; stone: OmokStone };
export type OmokRoomViewProps = {
  code: string;
  players: readonly OmokParticipant[];
  currentUserId: string;
  hostId: string;
  pending?: boolean;
  error?: string | null;
  onStart?: () => void;
  onLeave?: () => void;
};

function ActionButton({ children, onClick, disabled = false, secondary = false }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <button type="button" className={secondary ? 'arena-button arena-button--outline' : 'arena-button'}
    disabled={disabled || !onClick} onClick={onClick}>{children}</button>;
}

export function OmokRoomPanel({
  code, players, currentUserId, hostId, pending = false, error, onStart, onLeave,
}: OmokRoomViewProps) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const isHost = currentUserId === hostId;
  const ready = players.length === 2;
  const validCode = typeof code === 'string' && code.length > 0;
  async function copyCode() {
    if (!validCode) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyFeedback('초대 코드를 복사했습니다.');
    } catch {
      setCopyFeedback('복사할 수 없습니다. 코드를 직접 선택해 복사해 주세요.');
    }
  }

  return <section className="arena-omok-panel" aria-label="오목 대기실">
    <header className="arena-omok-panel-heading">
      <div><p className="arena-section-kicker">OMOK · CASUAL</p><h2>일반전 대기실</h2></div>
      <span className="arena-omok-panel-pill" role="status">참가자 {players.length}/2</span>
    </header>
    <div className="arena-omok-room-code">
      <div><span>초대 코드</span><strong aria-label="방 코드">{validCode ? code : '확인 중'}</strong></div>
      <ActionButton onClick={validCode ? () => void copyCode() : undefined} secondary>코드 복사</ActionButton>
    </div>
    <p role="status" aria-live="polite" className="arena-omok-panel-hint">
      {copyFeedback || '상대방에게 코드를 공유해 주세요.'}
    </p>
    <ol className="arena-omok-players" aria-label="참가자">
      {players.slice(0, 2).map((player, index) =>
        <li key={player.id}>
          <span className={'arena-omok-player-stone arena-omok-player-stone--' + player.stone} aria-hidden="true"/>
          <span className="arena-omok-player-name">{player.nickname || '플레이어'}{player.id === currentUserId ? ' (나)' : ''}</span>
          <small>{player.id === hostId ? '방장' : '참가자'}</small>
          <span className="arena-omok-player-seat">자리 {index + 1}</span>
        </li>,
      )}
      {players.length < 2 && <li className="arena-omok-empty-seat"><span aria-hidden="true">○</span>상대 입장 대기 중</li>}
    </ol>
    <p className="arena-omok-panel-hint" role="status">{ready
      ? isHost ? '두 명이 모였습니다. 방장이 시작할 수 있습니다.' : '방장의 경기 시작을 기다리고 있습니다.'
      : '두 명이 입장하면 경기를 시작할 수 있습니다.'}</p>
    {error && <p className="arena-omok-panel-error" role="alert">{error}</p>}
    <div className="arena-omok-panel-actions">
      {isHost && <ActionButton onClick={onStart} disabled={!ready || pending}>{pending ? '처리 중…' : '경기 시작'}</ActionButton>}
      <ActionButton onClick={onLeave} disabled={pending} secondary>방 나가기</ActionButton>
    </div>
  </section>;
}

export type OmokMatchViewProps = {
  board: unknown;
  players: readonly OmokParticipant[];
  currentUserId: string;
  turnUserId: string | null;
  status: 'waiting' | 'active' | 'finished';
  lastMove?: OmokPosition | null;
  winnerId?: string | null;
  finishReason?: string | null;
  pending?: boolean;
  reconnecting?: boolean;
  error?: string | null;
  rematchReadyCount?: number;
  myRematchVote?: boolean;
  onPlace?: (position: OmokPosition) => void;
  onForfeit?: () => void;
  onRematch?: () => void;
  onReturn?: () => void;
  onRankedReplay?: () => void;
  mode?: 'casual' | 'ranked';
  chat?: ReactNode;
  extra?: ReactNode;
};

export function OmokMatchPanel({
  board, players, currentUserId, turnUserId, status, lastMove, winnerId,
  finishReason, pending = false, reconnecting = false, error, rematchReadyCount = 0,
  myRematchVote = false, onPlace, onForfeit, onRematch, onReturn,
  onRankedReplay, mode = 'casual', chat, extra,
}: OmokMatchViewProps) {
  const me = players.find(p => p.id === currentUserId);
  const turn = players.find(p => p.id === turnUserId);
  const finished = status === 'finished';
  const myTurn = status === 'active' && !reconnecting && turnUserId === currentUserId;
  const result = finished
    ? winnerId === null || !winnerId ? '무승부' : winnerId === currentUserId ? '승리' : '패배'
    : null;

  return <section className="arena-omok-panel arena-omok-match-panel" aria-label="오목 경기">
    <header className="arena-omok-panel-heading">
      <div><p className="arena-section-kicker">OMOK · 15×15</p><h2>{mode === 'ranked' ? '오목 랭크전' : '오목 일반전'}</h2></div>
      <span role="status" className="arena-omok-panel-pill">{finished ? '경기 종료' : reconnecting
        ? '연결 복구 중' : status === 'waiting' ? '경기 대기' : myTurn ? '내 차례' : '상대 차례'}</span>
    </header>
    <ol className="arena-omok-players arena-omok-match-players" aria-label="대국자">
      {players.map(player => <li key={player.id} aria-current={player.id === turnUserId && !finished ? 'true' : undefined}>
        <span className={'arena-omok-player-stone arena-omok-player-stone--' + player.stone} aria-hidden="true"/>
        <span className="arena-omok-player-name">{player.nickname || '플레이어'}{player.id === currentUserId ? ' (나)' : ''}</span>
        <small>{player.stone === 'black' ? '흑돌' : '백돌'}</small>
      </li>)}
    </ol>
    <div className="arena-omok-match-layout">
      <div className="arena-omok-board-stage">
        <OmokBoardView board={board} lastMove={lastMove} stoneToPlace={me?.stone ?? 'black'}
          myTurn={myTurn} status={status} pending={pending || reconnecting} onPlace={onPlace}/>
        {finished && <OmokResultOverlay
          outcome={result ?? '무승부'} mode={mode} finishReason={finishReason}
          pending={pending || reconnecting} error={error}
          myRematchVote={myRematchVote} rematchReadyCount={rematchReadyCount}
          onReplay={mode === 'ranked' ? onRankedReplay : onRematch}
          onReturn={onReturn}/>}
      </div>
      <aside className="arena-omok-match-side" aria-label="대국 진행">
        <h3>경기 현황</h3>
        <p role="status" aria-live="polite">{finished
          ? `대국 종료 · ${result}${finishReason ? ' · ' + finishReason : ''}`
          : reconnecting ? '연결 복구 중입니다. 서버 상태를 확인하고 있습니다.'
          : pending ? '서버 응답을 확인 중입니다.'
          : status === 'waiting' ? '경기 시작을 기다리고 있습니다.'
          : myTurn ? '차례입니다. 빈 교차점에 착수해 주세요.'
          : `${turn?.nickname || '상대'}님의 착수를 기다리고 있습니다.`}</p>
        {error && <p className="arena-omok-panel-error" role="alert">{error}</p>}
        {finished && onRematch && <p className="arena-omok-panel-hint">재대결 동의 {Math.min(2, Math.max(0, rematchReadyCount))}/2</p>}
        {!finished && <div className="arena-omok-panel-actions">
          <ActionButton onClick={onForfeit} disabled={pending || reconnecting || status !== 'active'} secondary>기권</ActionButton>
          <ActionButton onClick={onReturn} secondary>로비로 돌아가기</ActionButton>
        </div>}
        {extra}
        {chat}
      </aside>
    </div>
  </section>;
}

export type OmokChatMessage = { id: string; senderId: string; senderName: string; body: string };
export type OmokChatPanelProps = {
  messages: readonly OmokChatMessage[];
  currentUserId: string;
  disabled?: boolean;
  sending?: boolean;
  error?: string | null;
  onSend?: (message: string) => Promise<boolean> | boolean;
};
export function OmokChatPanel({
  messages, currentUserId, disabled = false, sending = false, error, onSend,
}: OmokChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = sending || localPending;
  const canSend = !disabled && !busy && !!onSend && !!draft.trim();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || !onSend) return;
    const body = draft.trim();
    setLocalPending(true);
    setLocalError('');
    try {
      if (await onSend(body)) setDraft(previous => previous.trim() === body ? '' : previous);
      else setLocalError('메시지 전송에 실패했습니다. 다시 시도해 주세요.');
    } catch {
      setLocalError('메시지 전송에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLocalPending(false);
      if (document.activeElement === document.body || document.activeElement === inputRef.current)
        inputRef.current?.focus({ preventScroll: true });
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.repeat || event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    if (canSend) event.currentTarget.form?.requestSubmit();
  }
  return <section className="arena-omok-panel arena-omok-chat" aria-label="오목 경기 채팅">
    <header className="arena-omok-panel-heading"><h2>대전 채팅</h2><span>참가자 전용</span></header>
    <ol aria-label="채팅 메시지" aria-live="polite" aria-relevant="additions text" className="arena-omok-chat-list">
      {messages.length === 0 && <li className="arena-omok-panel-hint">아직 메시지가 없습니다.</li>}
      {messages.map(message => <li key={message.id}
        className={message.senderId === currentUserId ? 'is-mine' : ''}>
        <small>{message.senderId === currentUserId ? '나' : message.senderName || '상대'}</small>
        <p>{message.body}</p>
      </li>)}
    </ol>
    <form onSubmit={event => void submit(event)}>
      <label htmlFor="arena-omok-chat-draft">메시지</label>
      <textarea ref={inputRef} id="arena-omok-chat-draft" rows={2} maxLength={280}
        value={draft} onChange={event => setDraft(event.target.value)}
        onKeyDown={onKeyDown} readOnly={busy} disabled={disabled}
        aria-describedby="arena-omok-chat-hint" placeholder="메시지를 입력해 주세요."/>
      <div className="arena-omok-chat-controls">
        <span id="arena-omok-chat-hint">Enter 전송 · Shift+Enter 줄바꿈 · {draft.length}/280</span>
        <ActionButton onClick={canSend ? () => inputRef.current?.form?.requestSubmit() : undefined} disabled={!canSend}>
          {busy ? '전송 중…' : '전송'}
        </ActionButton>
      </div>
      {(error || localError) && <p role="alert" className="arena-omok-panel-error">{error || localError}</p>}
    </form>
  </section>;
}
