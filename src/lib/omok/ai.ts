import {
  OMOK_SIZE, hasFive, validOmokBoard, type OmokBoard, type OmokMove, type Stone,
} from '@/lib/omok/engine';

export const OMOK_AI_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type OmokAiDifficulty = typeof OMOK_AI_DIFFICULTIES[number];
export function isOmokAiDifficulty(value: unknown): value is OmokAiDifficulty {
  return typeof value === 'string' && OMOK_AI_DIFFICULTIES.includes(value as OmokAiDifficulty);
}

const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
function inside(r: number, c: number) { return r >= 0 && c >= 0 && r < OMOK_SIZE && c < OMOK_SIZE; }
function centerDistance(p: OmokMove) {
  return Math.abs(p.row - 7) + Math.abs(p.col - 7);
}
function candidates(board: OmokBoard): OmokMove[] {
  const occupied: OmokMove[] = [];
  for (let r = 0; r < OMOK_SIZE; r++) for (let c = 0; c < OMOK_SIZE; c++) {
    if (board[r][c]) occupied.push({ row: r, col: c });
  }
  if (!occupied.length) return [{ row: 7, col: 7 }];
  const seen = new Set<number>();
  for (const cell of occupied) {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const r = cell.row + dr, c = cell.col + dc;
      if (inside(r, c) && board[r][c] === null) seen.add(r * OMOK_SIZE + c);
    }
  }
  return [...seen].sort((a, b) => a - b).map(n => ({
    row: Math.floor(n / OMOK_SIZE), col: n % OMOK_SIZE,
  }));
}
function withStone(board: OmokBoard, move: OmokMove, color: Stone): OmokBoard {
  const changed = board.map(row => [...row]);
  changed[move.row][move.col] = color;
  return changed;
}
function pointScore(board: OmokBoard, move: OmokMove, color: Stone): number {
  if (board[move.row][move.col] !== null) return -Infinity;
  const placed = withStone(board, move, color);
  if (hasFive(placed, move.row, move.col, color)) return 1_000_000;
  let score = 0;
  for (const [dr, dc] of directions) {
    let stones = 1, open = 0;
    for (const sign of [-1, 1]) {
      let r = move.row + dr * sign, c = move.col + dc * sign;
      while (inside(r, c) && placed[r][c] === color) {
        stones++; r += dr * sign; c += dc * sign;
      }
      if (inside(r, c) && placed[r][c] === null) open++;
    }
    const weight = stones === 4 ? 30000 : stones === 3 ? 900 :
      stones === 2 ? 70 : 4;
    score += weight * (open === 2 ? 3 : open === 1 ? 1 : 0.08);
  }
  return score - centerDistance(move) * 0.12;
}
function fastHash(board: OmokBoard, turn: number): number {
  let h = (turn * 2654435761) >>> 0;
  for (let r = 0; r < OMOK_SIZE; r++) for (let c = 0; c < OMOK_SIZE; c++) {
    const value = board[r][c] === 'black' ? 1 : board[r][c] === 'white' ? 2 : 0;
    h = (Math.imul(h ^ (value + r * 17 + c * 37), 2246822519) >>> 0);
  }
  return h;
}
function other(color: Stone): Stone { return color === 'black' ? 'white' : 'black'; }
function bestOf(board: OmokBoard, moves: OmokMove[], color: Stone) {
  return moves.map(move => ({ move, score: pointScore(board, move, color) }))
    .sort((a, b) => b.score - a.score ||
      centerDistance(a.move) - centerDistance(b.move) ||
      a.move.row - b.move.row || a.move.col - b.move.col);
}

/** Pure deterministic decision function. Server decides when to call it. */
export function chooseOmokAiMove(
  board: OmokBoard, color: Stone, difficulty: OmokAiDifficulty, turn: number,
): OmokMove {
  if (!validOmokBoard(board)) throw Error('INVALID_BOARD');
  if (color !== 'black' && color !== 'white') throw Error('INVALID_STONE');
  if (!isOmokAiDifficulty(difficulty) || !Number.isInteger(turn) || turn < 1)
    throw Error('INVALID_DIFFICULTY');
  const moves = candidates(board);
  if (!moves.length) throw Error('NO_LEGAL_MOVE');
  if (difficulty === 'easy') {
    return moves[fastHash(board, turn) % moves.length];
  }
  const enemy = other(color);
  const offense = bestOf(board, moves, color);
  if (offense[0].score >= 1_000_000) return offense[0].move;
  const defense = bestOf(board, moves, enemy);
  if (defense[0].score >= 1_000_000) return defense[0].move;

  // Find tactical candidates from offense and defense. Keep the branching
  // factor bounded to stay within Vercel serverless CPU budgets.
  const enemyScores = new Map(defense.map(x => [x.move.row * 15 + x.move.col, x.score]));
  const tactical = offense.map(x => ({
    move: x.move, offensive: x.score,
    defensive: enemyScores.get(x.move.row * 15 + x.move.col) ?? 0,
  })).sort((a, b) =>
    (b.offensive + b.defensive * 0.95) - (a.offensive + a.defensive * 0.95) ||
    centerDistance(a.move) - centerDistance(b.move) ||
    a.move.row - b.move.row || a.move.col - b.move.col);
  if (difficulty === 'normal') return tactical[0].move;

  const shortlist = tactical.slice(0, 18);
  let best = shortlist[0].move, bestValue = -Infinity;
  for (const choice of shortlist) {
    const next = withStone(board, choice.move, color);
    const responses = candidates(next);
    let worst = 0;
    for (const reply of responses) {
      const score = pointScore(next, reply, enemy);
      if (score > worst) worst = score;
      if (worst >= 1_000_000) break;
    }
    const value = choice.offensive + choice.defensive * 1.12 - worst * 0.95;
    if (value > bestValue) { bestValue = value; best = choice.move; }
  }
  return best;
}
