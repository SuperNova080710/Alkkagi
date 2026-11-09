'use client';

import { Chess, type Square } from 'chess.js';
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { ChessMove } from '@/lib/chess/engine';
import { chessMoveOffset, chessTransition } from './move-feedback';

const symbols = {p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'};
const pieces = {p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹'};

export function ChessBoard({fen, black, enabled, onMove}: {
  fen: string; black: boolean; enabled: boolean; onMove: (move: ChessMove) => void;
}) {
  const [view, setView] = useState(() => ({fen, black, lastMove: null as ReturnType<typeof chessTransition>}));
  const game = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [promotion, setPromotion] = useState<ChessMove[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Keep board identity across plies, while clearing input from the old position.
  if (view.fen !== fen || view.black !== black) {
    setView({fen, black, lastMove: view.black === black ? chessTransition(view.fen, fen) : null});
    setSelected(null);
    setPromotion([]);
  }
  const lastMove = view.fen === fen && view.black === black ? view.lastMove : null;
  const ranks = game.board();
  const board = (black ? ranks.slice().reverse().map(rank => rank.slice().reverse()) : ranks).flat();
  const targets = enabled && selected ? game.moves({square: selected, verbose: true}) : [];

  function select(square: Square) {
    if (!enabled || promotion.length) return;
    const moves = targets.filter(move => move.to === square);
    if (moves.length) {
      const options = moves.map(({from,to,promotion}) => ({from,to,
        ...(promotion ? {promotion: promotion as NonNullable<ChessMove['promotion']>} : {}),
      }));
      if (options.length > 1) setPromotion(options);
      else { setSelected(null); onMove(options[0]); }
      return;
    }
    setSelected(game.get(square)?.color === game.turn() && selected !== square ? square : null);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const destination = {ArrowUp: Math.max(0, row - 1) * 8 + col, ArrowDown: Math.min(7, row + 1) * 8 + col,
      ArrowLeft: row * 8 + Math.max(0, col - 1), ArrowRight: row * 8 + Math.min(7, col + 1)}[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    buttons.current[destination]?.focus();
  }

  return <>
    <div className="chess-board" role="group" aria-label="체스판. 방향키로 이동하고 Enter로 선택">
      {board.map((piece, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const square = ((black ? 'hgfedcba' : 'abcdefgh')[col] + (black ? row + 1 : 8 - row)) as Square;
        const moving = lastMove?.moving.find(move => move.to === square);
        const offset = moving ? chessMoveOffset(moving.from, moving.to, black) : null;
        const inCheck = piece?.type === 'k' && piece.color === game.turn() && game.isCheck();
        return <button key={square} ref={element => {buttons.current[index] = element;}}
          type="button" className={'chess-square chess-square--' + ((row + col) % 2 ? 'dark' : 'light')}
          aria-label={square + (piece ? ` ${piece.color === 'w' ? '백' : '흑'} ${pieces[piece.type]}` : ' 빈 칸') + (lastMove?.from === square ? ' · 마지막 출발' : '') + (lastMove?.to === square ? ' · 마지막 도착' : '') + (inCheck ? ' · 체크' : '')}
          data-last={lastMove?.to === square ? 'to' : lastMove?.from === square ? 'from' : undefined}
          data-check={inCheck || undefined}
          data-movable={enabled && piece?.color === game.turn() || undefined}
          aria-disabled={!enabled || undefined}
          aria-pressed={enabled && selected === square} tabIndex={focusIndex === index ? 0 : -1}
          data-target={targets.some(move => move.to === square) || undefined}
          onFocus={() => setFocusIndex(index)} onKeyDown={event => navigate(event, index)} onClick={() => select(square)}>
          {(col === 0 || row === 7) && <span className="chess-coord" aria-hidden="true">{square}</span>}
          {piece && <span key={fen + square} className={'chess-piece chess-piece--' + piece.color + (moving ? ' chess-piece--moving' : '')}
            style={offset ? {'--chess-move-x': `${offset.x}%`, '--chess-move-y': `${offset.y}%`} as CSSProperties : undefined}
            aria-hidden="true">{symbols[piece.type]}</span>}
        </button>;
      })}
    </div>
    {promotion.length > 0 && <fieldset className="chess-promotion">
      <legend>승격할 기물 선택</legend>
      <div className="chess-actions">
        {promotion.map(move => <button key={move.promotion} className="arena-button" disabled={!enabled}
          type="button" onClick={() => {setPromotion([]); setSelected(null); onMove(move);}}>
          {pieces[move.promotion!]}
        </button>)}
        <button type="button" className="arena-button arena-button--outline" onClick={() => setPromotion([])}>취소</button>
      </div>
    </fieldset>}
  </>;
}
