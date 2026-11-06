import { Chess, type Move } from 'chess.js';
import type { ChessMove } from './engine';

export type ChessDifficulty = 'easy' | 'normal' | 'hard';
const value = {p: 100, n: 320, b: 330, r: 500, q: 900, k: 0};

function coordinateMove({from,to,promotion}: Move): ChessMove {
  return {from,to,...(promotion ? {promotion:promotion as NonNullable<ChessMove['promotion']>} : {})};
}

function material(game: Chess) {
  let score = 0;
  for (const rank of game.board()) for (const piece of rank) {
    if (piece) score += (piece.color === 'b' ? 1 : -1) * value[piece.type];
  }
  return score;
}

export function chooseChessAiMove(fen: string, difficulty: ChessDifficulty): ChessMove | null {
  const game = new Chess(fen);
  if (game.turn() !== 'b') return null;
  const moves = game.moves({verbose:true});
  if (!moves.length) return null;
  if (difficulty === 'easy') return coordinateMove(moves[Math.floor(Math.random() * moves.length)]);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    game.move(move);
    if (game.isCheckmate()) return coordinateMove(move);
    const [file,rank] = move.to;
    const centre = 7 - Math.abs(file.charCodeAt(0) - 100.5) - Math.abs(Number(rank) - 4.5);
    let score = game.isDraw() ? 0 : material(game) + centre;
    if (difficulty === 'hard' && !game.isDraw()) {
      let worst = Infinity;
      for (const reply of game.moves({verbose:true})) {
        game.move(reply);
        const response = game.isCheckmate() ? -100_000 : game.isDraw() ? 0 : material(game);
        game.undo();
        worst = Math.min(worst,response);
      }
      score = worst + centre;
    }
    game.undo();
    if (score > bestScore) {bestScore = score; best = move;}
  }
  return coordinateMove(best);
}
