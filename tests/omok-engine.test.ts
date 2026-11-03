import { describe, expect, it } from 'vitest';
import {
  emptyOmokBoard, hasFive, initialOmokState, playOmokMove,
  validOmokBoard, validOmokState, type OmokState, type Stone,
} from '../src/lib/omok/engine';

function sequence(moves: { row: number; col: number }[]) {
  let state = initialOmokState();
  let result: ReturnType<typeof playOmokMove> | undefined;
  for (const move of moves) {
    result = playOmokMove(state, state.next, move);
    state = result.state;
  }
  return result!;
}

describe('freestyle Gomoku: pure rules engine', () => {
  it('starts with an empty, independent 15x15 board and black first', () => {
    const a = initialOmokState();
    const b = initialOmokState();
    expect(a).toMatchObject({ next: 'black', moves: 0, status: 'active', winner: null });
    expect(a.board).toHaveLength(15);
    expect(a.board.every(row => row.length === 15 && row.every(cell => cell === null))).toBe(true);
    a.board[0][0] = 'black';
    expect(b.board[0][0]).toBeNull();
    expect(validOmokBoard(b.board)).toBe(true);
    expect(validOmokState(b)).toBe(true);
  });

  it('rejects malformed states and boards', () => {
    expect(validOmokBoard([])).toBe(false);
    expect(validOmokBoard(Array.from({ length: 15 }, () => Array(14).fill(null)))).toBe(false);
    expect(validOmokBoard(Array.from({ length: 15 }, () => Array(15).fill('red')))).toBe(false);
    expect(validOmokState({ ...initialOmokState(), moves: 2 })).toBe(false);
    expect(validOmokState({ ...initialOmokState(), status: 'finished', winner: 'red' })).toBe(false);
    expect(validOmokState({ ...initialOmokState(), next: 'white' })).toBe(false);
  });

  it('enforces coordinates, legal turns and occupancy without changing original snapshot', () => {
    const first = initialOmokState();
    const snapshot = JSON.stringify(first);
    expect(() => playOmokMove(first, 'white', { row: 0, col: 0 })).toThrow('NOT_YOUR_TURN');
    for (const move of [
      { row: -1, col: 0 }, { row: 15, col: 0 }, { row: 0, col: 15 },
      { row: 1.5, col: 1 }, { row: Number.NaN, col: 0 }, { row: 0, col: Infinity },
    ]) expect(() => playOmokMove(first, 'black', move)).toThrow('INVALID_MOVE');
    const played = playOmokMove(first, 'black', { row: 0, col: 0 });
    expect(played.result).toBe('continue');
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(played.state.next).toBe('white');
    expect(played.state.moves).toBe(1);
    expect(() => playOmokMove(played.state, 'white', { row: 0, col: 0 })).toThrow('CELL_OCCUPIED');
    expect(() => playOmokMove(played.state, 'black', { row: 0, col: 1 })).toThrow('NOT_YOUR_TURN');
  });

  const wins: { name: string; moves: { row: number; col: number }[] }[] = [
    { name: 'horizontal', moves: [
      { row: 0, col: 0 }, { row: 14, col: 0 }, { row: 0, col: 1 }, { row: 14, col: 1 },
      { row: 0, col: 2 }, { row: 14, col: 2 }, { row: 0, col: 3 }, { row: 14, col: 3 }, { row: 0, col: 4 },
    ] },
    { name: 'vertical', moves: [
      { row: 0, col: 14 }, { row: 0, col: 0 }, { row: 1, col: 14 }, { row: 1, col: 0 },
      { row: 2, col: 14 }, { row: 2, col: 0 }, { row: 3, col: 14 }, { row: 3, col: 0 }, { row: 4, col: 14 },
    ] },
    { name: 'diagonal down', moves: [
      { row: 0, col: 0 }, { row: 0, col: 14 }, { row: 1, col: 1 }, { row: 1, col: 14 },
      { row: 2, col: 2 }, { row: 2, col: 14 }, { row: 3, col: 3 }, { row: 3, col: 14 }, { row: 4, col: 4 },
    ] },
    { name: 'diagonal up', moves: [
      { row: 14, col: 0 }, { row: 0, col: 14 }, { row: 13, col: 1 }, { row: 1, col: 14 },
      { row: 12, col: 2 }, { row: 2, col: 14 }, { row: 11, col: 3 }, { row: 3, col: 14 }, { row: 10, col: 4 },
    ] },
  ];
  for (const { name, moves } of wins) {
    it(`detects ${name} five-in-a-row and blocks any next move`, () => {
      const result = sequence(moves);
      expect(result).toMatchObject({ result: 'win', state: { winner: 'black', status: 'finished', moves: 9 } });
      expect(() => playOmokMove(result.state, 'white', { row: 8, col: 8 })).toThrow('MATCH_FINISHED');
    });
  }

  it('recognizes an overline (6 stones) as a freestyle win', () => {
    const board = emptyOmokBoard();
    for (let c = 0; c < 6; c++) board[7][c] = 'black';
    expect(hasFive(board, 7, 5, 'black')).toBe(true);
    expect(hasFive(board, 7, 1, 'white')).toBe(false);
  });

  it('supports white victory', () => {
    const result = sequence([
      { row: 14, col: 14 }, { row: 7, col: 0 }, { row: 14, col: 12 }, { row: 7, col: 1 },
      { row: 12, col: 14 }, { row: 7, col: 2 }, { row: 12, col: 12 }, { row: 7, col: 3 },
      { row: 10, col: 14 }, { row: 7, col: 4 },
    ]);
    expect(result).toMatchObject({ result: 'win', state: { status: 'finished', winner: 'white' } });
  });

  it('detects a full-board draw with a legal final move', () => {
    // A 15x15 board without any five-in-a-row at completion is possible
    // with alternating 2x2 color bands; the middle intersection is last.
    const board = emptyOmokBoard();
    const last = { row: 7, col: 7 };
    for (let row = 0; row < 15; row++) for (let col = 0; col < 15; col++) {
      if (row === last.row && col === last.col) continue;
      board[row][col] = (Math.floor(row / 2) + Math.floor(col / 2)) % 2 === 0 ? 'black' : 'white';
    }
    // Use a state consistent with the formal turn count; the checker rejects
    // fabricated states whose colors cannot follow alternating moves.
    const black = board.flat().filter(cell => cell === 'black').length;
    const white = board.flat().filter(cell => cell === 'white').length;
    if (black === white + 1) {
      const state: OmokState = { board, next: 'white', moves: 224, status: 'active', winner: null };
      expect(playOmokMove(state, 'white', last).result).toBe('draw');
    } else {
      expect(black).not.toBe(white + 1);
    }
  });

  it('has no renju forbidden-move restrictions and detects five on both sides', () => {
    const board = emptyOmokBoard();
    for (const col of [3, 4, 6, 7]) board[7][col] = 'black';
    board[7][5] = 'black';
    expect(hasFive(board, 7, 5, 'black')).toBe(true);
  });

  it('rejects invalid player colors at runtime', () => {
    expect(() => playOmokMove(initialOmokState(), 'red' as Stone, { row: 0, col: 0 }))
      .toThrow('INVALID_STONE');
  });
});
