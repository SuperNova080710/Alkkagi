import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { chessMoveOffset, chessTransition } from '../src/components/chess/move-feedback';
import { ChessTurnStatus } from '../src/components/chess/chess-turn-status';
import { ChessBoard } from '../src/components/chess/chess-board';

function transition(fen: string, move: string) {
  const game = new Chess(fen);
  game.move(move);
  return chessTransition(fen, game.fen());
}

describe('chess movement feedback', () => {
  it('animates only one legal ply, ignores repeated snapshots and reconnect gaps', () => {
    expect(transition(DEFAULT_POSITION, 'e4')?.moving).toEqual([{from:'e2',to:'e4'}]);
    expect(chessTransition(DEFAULT_POSITION, DEFAULT_POSITION)).toBeNull();
    const game = new Chess(); game.move('e4'); game.move('e5');
    expect(chessTransition(DEFAULT_POSITION, game.fen())).toBeNull();
    expect(chessTransition(game.fen(), DEFAULT_POSITION)).toBeNull();
  });

  it.each([
    ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','O-O','e1','g1','h1','f1'],
    ['r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1','O-O-O','e8','c8','a8','d8'],
  ])('moves both king and rook for castling: %s', (fen, san, from, to, rookFrom, rookTo) => {
    expect(transition(fen,san)?.moving).toEqual([{from,to},{from:rookFrom,to:rookTo}]);
  });

  it.each([
    ['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2','exd6','e5','d6'],
    ['4k3/P7/8/8/8/8/8/4K3 w - - 0 1','a8=N','a7','a8'],
    ['4k3/8/8/8/8/3p4/4P3/4K3 w - - 0 1','exd3','e2','d3'],
  ])('supports en passant, underpromotion and capture: %s', (fen,san,from,to) => {
    expect(transition(fen,san)?.moving).toEqual([{from,to}]);
  });

  it.each([
    ['e2','e4',false,0,200],['e2','e4',true,0,-200],
    ['b1','c3',false,-100,200],['b1','c3',true,100,-200],
    ['h8','f8',true,-200,0],
  ] as [Square,Square,boolean,number,number][])('maps %s to %s at black=%s', (from,to,black,x,y) => {
    const actual = chessMoveOffset(from,to,black);
    expect(actual.x === x && actual.y === y).toBe(true);
  });

  it('keeps initial boards static, accessible, and highlights a checked king', () => {
    const markup = renderToStaticMarkup(<ChessBoard fen={DEFAULT_POSITION} black={false} enabled onMove={() => {}}/>);
    expect(markup.match(/<button/g)).toHaveLength(64);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup).not.toContain('chess-piece--moving');
    expect(markup).not.toContain('data-last');
    const check = renderToStaticMarkup(<ChessBoard fen="4k3/8/8/8/8/8/4r3/4K3 w - - 0 1" black enabled={false} onMove={() => {}}/>);
    expect(check).toContain('e1 백 킹 · 체크');
    expect(check.match(/data-check="true"/g)).toHaveLength(1);
    expect(check.match(/aria-disabled="true"/g)).toHaveLength(64);
  });
});

describe('chess turn banner', () => {
  const base = {black:false, myTurn:true, finished:false, inCheck:false};
  it.each([
    [{},'mine','내 차례입니다'],
    [{myTurn:false},'opponent','상대 차례입니다'],
    [{myTurn:false,ai:true},'opponent','AI가 생각 중입니다'],
    [{pending:true},'pending','이동을 확인하고 있습니다'],
    [{error:true,pending:true},'error','연결 확인이 필요합니다'],
    [{confirming:true},'confirming','기권을 확인하고 있습니다'],
    [{finished:true,error:true},'finished','대국 종료'],
  ])('announces the current input state %s', (props,state,title) => {
    const html = renderToStaticMarkup(<ChessTurnStatus {...base} {...props}/>);
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain(title);
    expect(html).toContain('aria-live="polite"');
    expect(html.includes('data-active="true"')).toBe(['mine','opponent'].includes(state));
  });
  it('identifies black and explains which king is checked', () => {
    const mine = renderToStaticMarkup(<ChessTurnStatus {...base} black inCheck/>);
    expect(mine).toContain('나 · 흑');
    expect(mine).toContain('킹을 지키는 수');
    const opponent = renderToStaticMarkup(<ChessTurnStatus {...base} myTurn={false} inCheck/>);
    expect(opponent).toContain('상대 킹이 체크 상태');
  });
});
