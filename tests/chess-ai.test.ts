import { describe, expect, it } from 'vitest';
import { chooseChessAiMove } from '../src/lib/chess/ai';
import { initialChessState, playChessMove } from '../src/lib/chess/engine';

describe('chess practice', () => {
  it.each(['easy','normal','hard'] as const)('selects a legal black reply at %s', difficulty => {
    const first = playChessMove(initialChessState(),{from:'e2',to:'e4'});
    if (!first.ok) throw Error(first.reason);
    const reply = chooseChessAiMove(first.position.fen,difficulty);
    expect(reply).not.toBeNull();
    expect(playChessMove(first.state,reply).ok).toBe(true);
  });

  it('takes immediate checkmate on normal and hard', () => {
    let state = initialChessState();
    for (const move of [{from:'f2',to:'f3'},{from:'e7',to:'e5'},{from:'g2',to:'g4'}]) {
      const step = playChessMove(state,move);
      if (!step.ok) throw Error(step.reason);
      state = step.state;
    }
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
    for (const difficulty of ['normal','hard'] as const) {
      const move = chooseChessAiMove(fen,difficulty);
      expect(playChessMove(state,move)).toMatchObject({ok:true,san:'Qh4#'});
    }
  });
});
