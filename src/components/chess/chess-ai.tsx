'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArenaPanel } from '@/components/ui/arena-panel';
import { chooseChessAiMove, type ChessDifficulty } from '@/lib/chess/ai';
import { initialChessState, inspectChessState, parseChessMove, playChessMove, type ChessMove, type ChessState } from '@/lib/chess/engine';
import { ChessBoard } from './chess-board';

type Session = {difficulty:ChessDifficulty; state:ChessState; notation:string[]; resigned:boolean};
const levels = {easy:'쉬움',normal:'보통',hard:'어려움'} as const;

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
  const key = 'chess-practice-v040:' + userId;
  const [session,setSession] = useState<Session|null>(null);
  const [loaded,setLoaded] = useState(false);
  const [error,setError] = useState('');
  const position = useMemo(() => session ? inspectChessState(session.state) : null,[session]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {setSession(recover(key)); setLoaded(true);}
    });
    return () => {cancelled = true;};
  },[key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (session) localStorage.setItem(key,JSON.stringify(session));
      else localStorage.removeItem(key);
    } catch { /* Practice can continue for the current tab. */ }
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

  if (!loaded) return <p role="status">연습 대전을 확인하는 중입니다.</p>;
  if (!session || !position) return <ArenaPanel title="체스 AI 대전">
    <p>난이도를 선택하면 백으로 바로 시작합니다. 연습 기보는 이 브라우저에 저장합니다.</p>
    <div className="chess-actions">
      {(Object.keys(levels) as ChessDifficulty[]).map(difficulty =>
        <button className="arena-button" key={difficulty} type="button"
          onClick={() => {setError('');setSession({difficulty,state:initialChessState(),notation:[],resigned:false});}}>
          {levels[difficulty]}
        </button>)}
    </div>
    <Link href="/chess" className="arena-text-link">체스 로비</Link>
  </ArenaPanel>;
  const finished = Boolean(position.outcome || session.resigned);
  const status = session.resigned ? '패배 · 기권'
    : position.outcome ? position.outcome.winner === 'w' ? '승리 · 체크메이트'
      : position.outcome.winner === 'b' ? '패배 · 체크메이트' : '무승부'
      : position.turn === 'w' ? '내 차례' : 'AI가 수를 고르는 중입니다.';
  return <div className="chess-game-layout">
    <ChessBoard key={session.notation.length} fen={position.fen} black={false}
      enabled={!finished && position.turn === 'w'} onMove={play}/>
    <ArenaPanel title={'체스 AI · ' + levels[session.difficulty]}>
      <p role="status">{status}{!finished && position.inCheck ? ' · 체크' : ''}</p>
      {error && <><p role="alert">{error}</p>
        <button type="button" className="arena-button" onClick={() => setError('')}>AI 다시 시도</button></>}
      <h3>기보</h3>
      <ol className="chess-history">{session.notation.map((san,i) => <li key={i}>{san}</li>)}</ol>
      <div className="chess-actions">
        <button type="button" className="arena-button" onClick={() => {
          if (finished) {setError('');setSession(null);}
          else setSession({...session,resigned:true});
        }}>{finished ? '다시하기' : '기권'}</button>
        <Link className="arena-button arena-button--outline" href="/chess">체스 로비</Link>
      </div>
    </ArenaPanel>
  </div>;
}
