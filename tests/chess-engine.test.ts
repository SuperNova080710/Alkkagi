import { describe, expect, it } from 'vitest';
import {
  initialChessState, inspectChessState, playChessMove,
  type ChessMove, type ChessState,
} from '../src/lib/chess/engine';

function play(state: ChessState, move: ChessMove) {
  const result = playChessMove(state, move);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function fromFen(initialFen: string): ChessState {
  return { initialFen, moves: [] };
}

describe('chess rule engine', () => {
  it('accepts a legal move, returns SAN and leaves the original state intact', () => {
    const initial = initialChessState();
    const result = play(initial, { from: 'e2', to: 'e4' });
    expect(result.san).toBe('e4');
    expect(result.position.turn).toBe('b');
    expect(result.position).toEqual(inspectChessState(result.state));
    expect(initial.moves).toEqual([]);
  });

  it('rejects invalid squares, wrong side, and a move leaving the king in check', () => {
    const initial = initialChessState();
    expect(playChessMove(initial, { from: 'e2\n', to: 'e4' })).toEqual({ ok: false, reason: 'invalid-input' });
    expect(playChessMove(initial, { from: 'e2', to: 'e4', promotion: 'k' })).toEqual({ ok: false, reason: 'invalid-input' });
    expect(playChessMove(initial, { from: 'e2', to: 'e4', promotion: 'q' })).toEqual({ ok: false, reason: 'illegal-move' });
    expect(playChessMove(initial, { from: 'e7', to: 'e5' })).toEqual({ ok: false, reason: 'illegal-move' });
    const pinned = fromFen('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
    expect(playChessMove(pinned, { from: 'e2', to: 'f2' })).toEqual({ ok: false, reason: 'illegal-move' });
  });

  it('allows castling only when the right exists and the transit square is safe', () => {
    expect(play(fromFen('4k3/8/8/8/8/8/8/4K2R w K - 0 1'), { from: 'e1', to: 'g1' }).san).toBe('O-O');
    for (const fen of [
      '4k3/8/8/8/8/8/8/4K2R w - - 0 1',
      'k4r2/8/8/8/8/8/8/4K2R w K - 0 1',
    ]) {
      expect(playChessMove(fromFen(fen), { from: 'e1', to: 'g1' })).toEqual({ ok: false, reason: 'illegal-move' });
    }
  });

  it('restores en passant from history and expires it after an intervening move', () => {
    const afterAdvance = play(fromFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'), { from: 'd7', to: 'd5' }).state;
    expect(play(afterAdvance, { from: 'e5', to: 'd6' }).position.fen).toBe('4k3/8/3P4/8/8/8/8/4K3 b - - 0 2');
    const afterWhiteWaits = play(afterAdvance, { from: 'e1', to: 'f1' }).state;
    const afterBlackWaits = play(afterWhiteWaits, { from: 'e8', to: 'f8' }).state;
    expect(playChessMove(afterBlackWaits, { from: 'e5', to: 'd6' })).toEqual({ ok: false, reason: 'illegal-move' });
  });

  it('requires explicit promotion and accepts all four pieces', () => {
    const state = fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(playChessMove(state, { from: 'a7', to: 'a8' })).toEqual({ ok: false, reason: 'illegal-move' });
    for (const promotion of ['q', 'r', 'b', 'n'] as const) {
      const result = play(state, { from: 'a7', to: 'a8', promotion });
      expect(result.san).toContain('=' + promotion.toUpperCase());
      expect(result.state.moves).toEqual([{ from: 'a7', to: 'a8', promotion }]);
    }
  });

  it('gives checkmate precedence over the move limit and blocks further play', () => {
    const state = fromFen('7k/5Q2/6K1/8/8/8/8/8 w - - 99 50');
    const result = play(state, { from: 'f7', to: 'g7' });
    expect(result.position.outcome).toEqual({ reason: 'checkmate', winner: 'w' });
    expect(result.position.inCheck).toBe(true);
    expect(playChessMove(result.state, { from: 'h8', to: 'h7' })).toEqual({ ok: false, reason: 'game-finished' });
  });

  it('distinguishes stalemate, insufficient material and the fifty-move rule', () => {
    expect(inspectChessState(fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).outcome)
      .toEqual({ reason: 'stalemate', winner: null });
    expect(inspectChessState(fromFen('4k3/8/8/8/8/8/8/4KB2 w - - 0 1')).outcome)
      .toEqual({ reason: 'insufficient-material', winner: null });
    const state = fromFen('4k3/8/8/8/8/8/8/4K2R w - - 99 50');
    expect(play(state, { from: 'h1', to: 'h2' }).position.outcome)
      .toEqual({ reason: 'fifty-move-rule', winner: null });
  });

  it('detects threefold repetition after a serialized state is restored', () => {
    const cycle = [
      { from: 'g1', to: 'f3' }, { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' }, { from: 'f6', to: 'g8' },
    ] as const;
    const secondPosition = cycle.reduce((state, move) => play(state, move).state, initialChessState());
    expect(inspectChessState(secondPosition).outcome).toBeNull();
    const restored: ChessState = JSON.parse(JSON.stringify(secondPosition));
    const thirdPosition = cycle.reduce((state, move) => play(state, move).state, restored);
    expect(inspectChessState(thirdPosition).outcome).toEqual({ reason: 'threefold-repetition', winner: null });
  });

  it('counts a position with an illegal pinned en passant capture as repeated', () => {
    const beforeAdvance = fromFen('k3r3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
    const { state, position } = play(beforeAdvance, { from: 'd7', to: 'd5' });
    expect(position.fen).toContain(' w - - ');
    expect(playChessMove(state, { from: 'e5', to: 'd6' })).toEqual({ ok: false, reason: 'illegal-move' });
    const cycle = [
      { from: 'e1', to: 'f1' }, { from: 'a8', to: 'b8' },
      { from: 'f1', to: 'e1' }, { from: 'b8', to: 'a8' },
    ] as const;
    const repeated = [...cycle, ...cycle].reduce((game, move) => play(game, move).state, state);
    expect(inspectChessState(repeated).outcome).toEqual({ reason: 'threefold-repetition', winner: null });
  });
});
