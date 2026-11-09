import { Chess, type Square } from 'chess.js';

export const CHESS_MOVE_DURATION = 280;

/** Only animate an observed, legal single ply; never infer moves across a reconnect gap. */
export function chessTransition(before: string, after: string) {
  if (before === after) return null;
  const move = new Chess(before).moves({verbose: true}).find(candidate => candidate.after === after);
  if (!move) return null;
  const moving: {from: Square; to: Square}[] = [{from: move.from, to: move.to}];
  const rank = move.color === 'w' ? '1' : '8';
  if (move.isKingsideCastle()) moving.push({from: `h${rank}`, to: `f${rank}`});
  if (move.isQueensideCastle()) moving.push({from: `a${rank}`, to: `d${rank}`});
  return {from: move.from, to: move.to, moving};
}

export function chessMoveOffset(from: Square, to: Square, black: boolean) {
  const direction = black ? -1 : 1;
  return {
    x: (from.charCodeAt(0) - to.charCodeAt(0)) * 100 * direction,
    y: (Number(to[1]) - Number(from[1])) * 100 * direction,
  };
}
