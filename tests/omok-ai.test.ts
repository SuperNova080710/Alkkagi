import { describe, expect, it } from 'vitest';
import { emptyOmokBoard, type OmokBoard } from '../src/lib/omok/engine';
import { chooseOmokAiMove, isOmokAiDifficulty } from '../src/lib/omok/ai';

function boardWith(black: [number,number][], white: [number,number][]): OmokBoard {
  const board=emptyOmokBoard();
  for(const [r,c] of black) board[r][c]='black';
  for(const [r,c] of white) board[r][c]='white';
  return board;
}

describe('Omok AI deterministic strategy', () => {
  it('validates all difficulty labels and starts in the center', () => {
    for(const level of ['easy','normal','hard'] as const) {
      expect(isOmokAiDifficulty(level)).toBe(true);
      expect(chooseOmokAiMove(emptyOmokBoard(),'black',level,1))
        .toEqual({row:7,col:7});
    }
    expect(isOmokAiDifficulty('expert')).toBe(false);
    expect(() => chooseOmokAiMove([], 'white','hard',1)).toThrow('INVALID_BOARD');
    expect(() => chooseOmokAiMove(emptyOmokBoard(),'white','hard',0)).toThrow('INVALID_DIFFICULTY');
  });

  it('never changes board and always chooses a free legal cell', () => {
    const board=boardWith([[7,7],[7,8]],[[8,7]]);
    const snapshot=JSON.stringify(board);
    for(const difficulty of ['easy','normal','hard'] as const) {
      const move=chooseOmokAiMove(board,'white',difficulty,4);
      expect(move.row).toBeGreaterThanOrEqual(0);
      expect(move.row).toBeLessThan(15);
      expect(move.col).toBeGreaterThanOrEqual(0);
      expect(move.col).toBeLessThan(15);
      expect(board[move.row][move.col]).toBeNull();
      expect(chooseOmokAiMove(board,'white',difficulty,4)).toEqual(move);
    }
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it('takes an immediate white win instead of defending', () => {
    const board=boardWith([[1,0],[3,0],[5,0],[7,0]],
      [[8,4],[8,5],[8,6],[8,7]]);
    for(const difficulty of ['normal','hard'] as const) {
      const move=chooseOmokAiMove(board,'white',difficulty,9);
      expect([{row:8,col:3},{row:8,col:8}]).toContainEqual(move);
    }
  });

  it('blocks the black immediate win', () => {
    const board=boardWith([[6,4],[6,5],[6,6],[6,7]],
      [[10,0],[10,2],[10,4]]);
    for(const difficulty of ['normal','hard'] as const) {
      const move=chooseOmokAiMove(board,'white',difficulty,9);
      expect([{row:6,col:3},{row:6,col:8}]).toContainEqual(move);
    }
  });

  it('rejects full board, and explores without exponential growth', () => {
    const board: OmokBoard=Array.from({length:15},(_,r)=>
      Array.from({length:15},(_,c)=>(r+c)%2===0?'black':'white'));
    expect(() => chooseOmokAiMove(board,'white','hard',225)).toThrow('NO_LEGAL_MOVE');
  });
});
