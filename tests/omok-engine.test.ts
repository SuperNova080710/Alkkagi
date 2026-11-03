import { describe, expect, it } from 'vitest';
import {
  emptyOmokBoard, hasFive, initialOmokState, playOmokMove,
  validOmokBoard, validOmokState, type OmokBoard, type OmokState, type Stone,
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

  it('rejects false terminal wins, false draws, early five, and both winners', () => {
    const empty = initialOmokState();
    expect(validOmokState({...empty,status:'finished'})).toBe(false);

    const won = sequence([
      { row: 0, col: 0 }, { row: 14, col: 0 },
      { row: 0, col: 1 }, { row: 14, col: 1 },
      { row: 0, col: 2 }, { row: 14, col: 2 },
      { row: 0, col: 3 }, { row: 14, col: 3 },
      { row: 0, col: 4 },
    ]).state;
    expect(validOmokState(won)).toBe(true);
    expect(validOmokState({...won,status:'active',winner:null})).toBe(false);
    expect(validOmokState({...won,status:'finished',winner:null})).toBe(false);

    const noLine=sequence([
      {row:0,col:0},{row:14,col:14},
      {row:0,col:2},{row:14,col:12},
      {row:0,col:4},
    ]).state;
    expect(validOmokState({...noLine,status:'finished',winner:'black'})).toBe(false);

    const impossible = won.board.map(row=>[...row]);
    for(const col of [2,3,4,5,6]) impossible[14][col]='white';
    // Restore parity using black stones away from the winning lines.
    for(const col of [7,8,9,10,11]) impossible[13][col]='black';
    expect(validOmokState({...won,board:impossible,moves:19,
      next:'white',status:'finished',winner:'black'})).toBe(false);
  });

  it('checks terminal lines with a bounded scan on fixed 15x15 boards', () => {
    const state=initialOmokState();
    const start=performance.now();
    for(let i=0;i<200;i++)expect(validOmokState(state)).toBe(true);
    // An intentionally generous upper bound catches pathological quadratic
    // rescans without being timing-sensitive across GitHub runners.
    expect(performance.now()-start).toBeLessThan(5000);
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
    // Fixture generated with exactly 112 stones of each color before the
    // final black turn, and no five-in-a-row in any direction.
    const fixture = [
      '010011000111100', '001101110011110', '111101000100110',
      '100001110010000', '001010101010101', '101010001100111',
      '010001110101100', '001100100111001', '101001111000010',
      '011101100111000', '000011001100010', '111000111100101',
      '101111010110100', '101011001011000', '101111010011001',
    ];
    const last = { row: 7, col: 7 };
    const board: OmokBoard = fixture.map(row => row.split('').map(bit => bit === '0' ? 'black' : 'white'));
    board[last.row][last.col] = null;
    const state: OmokState = { board, next: 'black', moves: 224, status: 'active', winner: null };
    expect(validOmokState(state)).toBe(true);
    const result = playOmokMove(state, 'black', last);
    expect(result.result).toBe('draw');
    expect(result.state).toMatchObject({ status: 'finished', winner: null, moves: 225 });
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
