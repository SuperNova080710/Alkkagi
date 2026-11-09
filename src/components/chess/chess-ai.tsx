'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArenaPanel } from '@/components/ui/arena-panel';
import { chooseChessAiMove, type ChessDifficulty } from '@/lib/chess/ai';
import { initialChessState, inspectChessState, parseChessMove, playChessMove, type ChessMove, type ChessState } from '@/lib/chess/engine';
import { OmokResultOverlay } from '@/components/omok/omok-result-overlay';
import { ChessBoard } from './chess-board';
import { ChessDifficultyForm, chessDifficultyLabels as levels } from './chess-difficulty-form';

type Session = {difficulty:ChessDifficulty; state:ChessState; notation:string[]; resigned:boolean};
const finishReasons = {
  checkmate: '체크메이트', stalemate: '스테일메이트', 'insufficient-material': '기물 부족',
  'threefold-repetition': '3회 반복', 'fifty-move-rule': '50수 규칙',
};

function newSession(difficulty: ChessDifficulty): Session {
  return {difficulty, state:initialChessState(), notation:[], resigned:false};
}

function save(key: string, session: Session) {
  try { localStorage.setItem(key, JSON.stringify(session)); }
  catch { /* Practice can continue for the current tab. */ }
}

function recover(key: string): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Session | null;
    if (!saved || !Object.hasOwn(levels,saved.difficulty) ||
        saved.state.initialFen !== initialChessState().initialFen ||
        saved.state.moves.some(move => !parseChessMove(move)) ||
        saved.notation.length !== saved.state.moves.length) return null;
    inspectChessState(saved.state);
    return saved;
  } catch {return null;}
}

export function ChessAi({userId}: {userId:string}) {
  const router = useRouter();
  const replay = useRef<HTMLDialogElement>(null);
  const key = 'chess-practice-v040:' + userId;
  const [session,setSession] = useState<Session|null>(null);
  const [loaded,setLoaded] = useState(false);
  const [error,setError] = useState('');
  const position = useMemo(() => session ? inspectChessState(session.state) : null,[session]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const chosen = window.location.hash.slice(1);
      if (Object.hasOwn(levels, chosen)) {
        const next = newSession(chosen as ChessDifficulty);
        save(key, next);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setSession(next);
      } else {
        setSession(recover(key));
      }
      setLoaded(true);
    });
    return () => {cancelled = true;};
  },[key]);
  useEffect(() => {
    if (loaded && session) save(key, session);
  },[key,loaded,session]);

  useEffect(() => {
    if (!session || session.resigned || !position || position.outcome || position.turn !== 'b' || error) return;
    const timer = window.setTimeout(() => {
      try {
        const move = chooseChessAiMove(position.fen,session.difficulty);
        const next = move && playChessMove(session.state,move);
        if (!next || !next.ok) throw Error('AI가 수를 고르지 못했습니다.');
        setSession({...session,state:next.state,notation:[...session.notation,next.san]});
      } catch {setError('AI가 수를 고르지 못했습니다. 다시 시도해 주세요.');}
    },180);
    return () => window.clearTimeout(timer);
  },[session,position,error]);

  function play(move: ChessMove) {
    if (!session || session.resigned || position?.turn !== 'w') return;
    const next = playChessMove(session.state,move);
    if (next.ok) setSession({...session,state:next.state,notation:[...session.notation,next.san]});
  }

  function start(difficulty: ChessDifficulty) {
    setError('');
    setSession(newSession(difficulty));
    replay.current?.close();
  }

  if (!loaded) return <p role="status">연습 대전을 확인하는 중입니다.</p>;
  if (!session || !position) return <ArenaPanel title="체스 AI 대전">
    <ChessDifficultyForm onStart={start}>
      <Link href="/chess" className="arena-text-link">체스 로비</Link>
    </ChessDifficultyForm>
  </ArenaPanel>;

  const finished = Boolean(position.outcome || session.resigned);
  const outcome = session.resigned || position.outcome?.winner === 'b' ? '패배'
    : position.outcome?.winner === 'w' ? '승리' : '무승부';
  const reason = session.resigned ? '기권' : position.outcome ? finishReasons[position.outcome.reason] : null;
  return <div className="chess-game-layout">
    <div className="chess-board-stage">
      <ChessBoard key={session.notation.length} fen={position.fen} black={false}
        enabled={!finished && position.turn === 'w'} onMove={play}/>
      {finished && <OmokResultOverlay game="chess" mode="ai" outcome={outcome} finishReason={reason}
        onReplay={() => replay.current?.showModal()} onReturn={() => router.push('/chess')}/>}
    </div>
    <ArenaPanel title={'체스 AI · ' + levels[session.difficulty]}>
      <p role="status">{finished ? outcome : position.turn === 'w' ? '내 차례' : 'AI가 수를 고르는 중입니다.'}
        {!finished && position.inCheck ? ' · 체크' : ''}</p>
      {!finished && error && <><p role="alert">{error}</p>
        <button type="button" className="arena-button" onClick={() => setError('')}>AI 다시 시도</button></>}
      <h3>기보</h3>
      <ol className="chess-history">{session.notation.map((san,i) => <li key={i}>{san}</li>)}</ol>
      {!finished && <div className="chess-actions">
        <button type="button" className="arena-button" onClick={() => setSession({...session,resigned:true})}>기권</button>
        <Link className="arena-button arena-button--outline" href="/chess">체스 로비</Link>
      </div>}
    </ArenaPanel>
    {finished && <dialog ref={replay} className="arena-dialog" aria-labelledby="chess-replay-title">
      <div className="arena-dialog-heading">
        <h2 id="chess-replay-title">AI와 다시 한 판!</h2>
        <button type="button" className="arena-close" aria-label="닫기"
          onClick={() => replay.current?.close()}>×</button>
      </div>
      <ChessDifficultyForm initial={session.difficulty} onStart={start}/>
    </dialog>}
  </div>;
}
