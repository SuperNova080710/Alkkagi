import { describe, expect, it } from 'vitest';
import { MAX_FORCE, MIN_FORCE, simulateShotWithFrames, type Board } from '../src/lib/game/engine';
import { summarizeTurn, extractFrames, type TurnShot } from '../src/lib/game/turn-history';
const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
const initial: Board = { pieces: [
 { id: 'a1', owner: a, x: 175, y: 250 },
 { id: 'b1', owner: b, x: 625, y: 250 },
] };
describe('shot force and replay frames', () => {
 it('enforces the same minimum and maximum power used in the UI', () => {
  expect(() => simulateShotWithFrames(initial, a, { pieceId: 'a1', dx: MIN_FORCE - 0.1, dy: 0 })).toThrow('INVALID_FORCE');
  expect(() => simulateShotWithFrames(initial, a, { pieceId: 'a1', dx: MAX_FORCE + 1, dy: 0 })).toThrow('INVALID_FORCE');
  expect(simulateShotWithFrames(initial, a, { pieceId: 'a1', dx: MAX_FORCE, dy: 0 }).board).toBeDefined();
 });
 it('produces bounded deterministic frames ending at the authoritative board', () => {
  const shot = { pieceId: 'a1', dx: MAX_FORCE, dy: 0 };
  const first = simulateShotWithFrames(initial, a, shot);
  const second = simulateShotWithFrames(initial, a, shot);
  expect(first).toEqual(second);
  expect(first.frames.length).toBeGreaterThan(2);
  expect(first.frames.length).toBeLessThanOrEqual(100);
  expect(first.frames[0]).toEqual(initial);
  expect(first.frames.at(-1)).toEqual(first.board);
 });
 it('computes fallen pieces on both sides from persisted before/after states', () => {
  const shot: TurnShot = {
   id: 'test', turn_no: 5, player_id: a, piece_id: 'a1', created_at: new Date().toISOString(),
   input: { expectedBoard: initial, frames: [initial, { pieces: [initial.pieces[0]] }] },
   result_state: { pieces: [initial.pieces[0]] },
  };
  expect(summarizeTurn(shot, a, b)).toMatchObject({
   turnNo: 5, playerId: a, firstLost: 0, secondLost: 1,
  });
  expect(extractFrames(shot)).toHaveLength(2);
 });
 it('does not trust malformed frame payloads', () => {
  const entry: TurnShot = {
   id: 'test', turn_no: 1, player_id: a, piece_id: 'a1', created_at: '',
   input: { expectedBoard: initial, frames: [{ pieces: [{ id: 'x', owner: a, x: Infinity, y: 0 }] }] },
   result_state: initial,
  };
  expect(extractFrames(entry)).toEqual([]);
 });
});
