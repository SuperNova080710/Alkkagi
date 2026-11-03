'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OmokBoardView, isOmokBoardCells, type OmokBoardCells, type OmokPosition } from './omok-board-view';
import { isRecord, isUuid, omokErrorText, omokRequest, type OmokClientError } from './omok-client-api';
import './omok-competitive.css';
import './omok-live.css';

export type AiDifficulty = 'easy' | 'normal' | 'hard';
const difficulties: { id: AiDifficulty; title: string; hint: string }[] = [
  { id: 'easy', title: '쉬움', hint: '처음 오목을 시작할 때 적합한 수준' },
  { id: 'normal', title: '보통', hint: '승리·방어 수를 고려하는 연습' },
  { id: 'hard', title: '어려움', hint: '좀 더 깊은 수읽기에 도전' },
];
export type AiSnapshot = {
  id: string; difficulty: AiDifficulty; turnNo: number; board: OmokBoardCells;
  status: 'active' | 'finished'; winner: 'human' | 'ai' | null;
  finishReason: string | null; lastMove: OmokPosition | null;
};
export function parseAiSnapshot(value: unknown): AiSnapshot {
  if (!isRecord(value) || !isRecord(value.match) || !Array.isArray(value.turns))
    throw Error('AI_MATCH_INVALID');
  const m = value.match;
  if (!isUuid(m.id) || !['easy','normal','hard'].includes(String(m.difficulty)) ||
    !Number.isInteger(m.turn_no) || !isOmokBoardCells(m.board_state) ||
    !['active','finished'].includes(String(m.status)))
    throw Error('AI_MATCH_INVALID');
  const turn = value.turns.at(-1) as unknown;
  const valid = (r: unknown, c: unknown) => Number.isInteger(r) && Number.isInteger(c) &&
    Number(r) >= 0 && Number(r) < 15 && Number(c) >= 0 && Number(c) < 15;
  let last: OmokPosition | null = null;
  if (isRecord(turn)) {
    if (valid(turn.ai_row,turn.ai_col)) last = { row: Number(turn.ai_row), col: Number(turn.ai_col) };
    else if (valid(turn.human_row,turn.human_col))
      last = { row: Number(turn.human_row), col: Number(turn.human_col) };
  }
  return {
    id: m.id, difficulty: m.difficulty as AiDifficulty, turnNo: m.turn_no as number,
    board: m.board_state, status: m.status as AiSnapshot['status'],
    winner: m.winner === 'human' || m.winner === 'ai' ? m.winner : null,
    finishReason: typeof m.finish_reason === 'string' ? m.finish_reason : null,
    lastMove: last,
  };
}
export function OmokAiLobby() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal');
  const [confirmation, setConfirmation] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  async function start() {
    if (locked.current) return;
    locked.current = true; setPending(true); setError('');
    try {
      const response = await omokRequest<unknown>('/api/omok/ai', {
        method: 'POST', body: { difficulty },
      });
      if (!isRecord(response) || !isUuid(response.matchId)) throw Error('AI_CREATE_INVALID');
      router.push('/omok/ai/' + response.matchId);
    } catch (cause) { setError(omokErrorText(cause)); }
    finally { locked.current = false; setPending(false); }
  }
  return <div className="arena-omok-live-stack">
    <section className="arena-omok-live-panel" aria-labelledby="omok-ai-heading">
      <div className="arena-omok-live-heading"><div>
        <p className="arena-section-kicker">OMOK · AI</p>
        <h1 id="omok-ai-heading">AI 오목 연습</h1>
        <p>흑돌로 먼저 시작합니다. AI 승부는 오목 랭크 RP에 영향을 주지 않습니다.</p>
      </div><Link href="/omok" className="arena-button arena-button--outline">오목 로비</Link></div>
      <fieldset className="arena-omok-difficulty" disabled={pending}>
        <legend>AI 난이도</legend>
        {difficulties.map(item => <label key={item.id} className={difficulty === item.id ? 'is-selected' : ''}>
          <input type="radio" name="omok-ai-difficulty" value={item.id}
            checked={difficulty === item.id} onChange={() => { setDifficulty(item.id); setConfirmation(false); }}/>
          <strong>{item.title}</strong><span>{item.hint}</span>
        </label>)}
      </fieldset>
      {!confirmation ? <button type="button" className="arena-button" onClick={() => setConfirmation(true)}>
        선택한 난이도 확인
      </button> : <div className="arena-omok-confirm" role="group" aria-label="오목 AI 시작 확인">
        <p>난이도 <strong>{difficulties.find(d => d.id === difficulty)?.title}</strong>로 대국을 시작하시겠습니까?</p>
        <button type="button" className="arena-button" disabled={pending} onClick={() => void start()}>
          {pending ? '대국 생성 중…' : 'AI 대전 시작'}
        </button>
        <button type="button" className="arena-button arena-button--outline" disabled={pending}
          onClick={() => setConfirmation(false)}>취소</button>
      </div>}
      {error && <p role="alert" className="arena-omok-live-error">{error}</p>}
    </section>
  </div>;
}

type Proposed = { requestId: string; turnNo: number; row: number; col: number };
export function OmokAiMatchClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<Proposed | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const lock = useRef(false);
  const pendingMove = useRef<Proposed | null>(null);

  const refresh = useCallback(async () => {
    const serial = ++sequence.current;
    try {
      const result = parseAiSnapshot(await omokRequest<unknown>('/api/omok/ai/' + matchId));
      if (sequence.current !== serial) return;
      setSnapshot(result); setReconnecting(false); setError('');
      if (pendingMove.current && result.turnNo !== pendingMove.current.turnNo) {
        pendingMove.current = null; setRetry(null);
      }
    } catch (cause) {
      if (sequence.current !== serial) return;
      setError(omokErrorText(cause)); setReconnecting(true);
    } finally { if (sequence.current === serial) setLoading(false); }
  }, [matchId]);
  useEffect(() => {
    const sequenceRef = sequence;
    queueMicrotask(() => { void refresh(); });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 4000);
    const onFocus = () => void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sequenceRef.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  async function submitMove(move: Proposed) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      await omokRequest('/api/omok/ai/' + matchId + '/move', {
        method: 'POST', body: move,
      });
      pendingMove.current = null; setRetry(null);
      await refresh();
    } catch (cause) {
      const code = (cause as OmokClientError | null)?.code;
      if (code === 'NETWORK_ERROR' || code === 'GAME_SERVICE_UNAVAILABLE') setRetry(move);
      else { pendingMove.current = null; setRetry(null); }
      await refresh();
      setError(omokErrorText(cause));
    } finally { lock.current = false; setPending(false); }
  }
  function onPlace(position: OmokPosition) {
    if (!snapshot || snapshot.status !== 'active' || pending || retry || pendingMove.current || lock.current) return;
    const proposal = { requestId: crypto.randomUUID(), turnNo: snapshot.turnNo,
      row: position.row, col: position.col };
    pendingMove.current = proposal;
    void submitMove(proposal);
  }
  async function forfeit() {
    if (lock.current || !window.confirm('AI와의 경기를 기권하시겠습니까?')) return;
    lock.current = true; setPending(true); setError('');
    try {
      await omokRequest('/api/omok/ai/' + matchId + '/forfeit', { method: 'POST' });
      await refresh();
    } catch (cause) { await refresh(); setError(omokErrorText(cause)); }
    finally { lock.current = false; setPending(false); }
  }
  async function again() {
    if (!snapshot || lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      const result = await omokRequest<unknown>('/api/omok/ai', {
        method: 'POST', body: { difficulty: snapshot.difficulty },
      });
      if (!isRecord(result) || !isUuid(result.matchId)) throw Error('AI_CREATE_INVALID');
      router.push('/omok/ai/' + result.matchId);
    } catch (cause) { setError(omokErrorText(cause)); }
    finally { lock.current = false; setPending(false); }
  }
  if (loading && !snapshot) return <p role="status" className="arena-omok-live-panel">AI 대국 정보를 불러오는 중…</p>;
  if (!snapshot) return <section className="arena-omok-live-panel">
    <p role="alert" className="arena-omok-live-error">{error || '대국 정보를 불러올 수 없습니다.'}</p>
    <button className="arena-button" onClick={() => void refresh()}>다시 조회</button>
    <Link className="arena-button arena-button--outline" href="/omok/ai">AI 대전 로비</Link>
  </section>;
  const finished = snapshot.status === 'finished';
  const status = finished ? snapshot.winner === 'human' ? '승리' :
    snapshot.winner === 'ai' ? '패배' : '무승부'
    : pending ? 'AI가 착수 계산 중입니다.' : reconnecting ? '연결 복구 중입니다.'
    : '내 턴 · 흑돌로 착수해 주세요.';
  return <section className="arena-omok-live-panel arena-omok-live-stack" aria-label="AI 오목 경기">
    <div className="arena-omok-live-heading"><div>
      <p className="arena-section-kicker">OMOK · AI</p><h1>AI 오목 대국</h1>
      <p>난이도: {difficulties.find(d => d.id === snapshot.difficulty)?.title}</p>
    </div><span className="arena-omok-panel-pill" role="status" aria-live="polite">{status}</span></div>
    <div className="arena-omok-match-layout">
      <OmokBoardView board={snapshot.board} lastMove={snapshot.lastMove}
        status={snapshot.status} myTurn={!finished && !reconnecting} stoneToPlace="black"
        pending={pending || reconnecting || !!retry} onPlace={onPlace}/>
      <aside className="arena-omok-match-side" aria-label="AI 대국 상태">
        <h3>경기 현황</h3>
        <p role="status">{status}</p>
        <p className="arena-omok-panel-hint">나: 흑돌 · AI: 백돌</p>
        <p className="arena-omok-panel-hint">AI 대전은 오목 랭크 RP가 변하지 않습니다. XP는 서버 기록을 기준으로 합니다.</p>
        {error && <p role="alert" className="arena-omok-live-error">{error}</p>}
        {retry && <div role="alert">
          <p>이전 착수의 결과가 불확실합니다. 같은 요청 번호로 재전송해 주세요.</p>
          <button className="arena-button" disabled={pending} onClick={() => void submitMove(retry)}>
            같은 착수 재시도
          </button>
        </div>}
        <div className="arena-omok-panel-actions">
          {!finished && <button className="arena-button arena-button--outline"
            disabled={pending || reconnecting} onClick={() => void forfeit()}>기권</button>}
          {finished && <button className="arena-button" disabled={pending}
            onClick={() => void again()}>{pending ? '생성 중…' : '같은 난이도로 다시하기'}</button>}
          <button className="arena-button arena-button--outline" onClick={() => void refresh()}>
            서버 상태 다시 조회
          </button>
          <Link className="arena-button arena-button--outline" href="/omok/ai">AI 대전 로비</Link>
        </div>
      </aside>
    </div>
  </section>;
}
