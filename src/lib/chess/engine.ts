import { Chess, DEFAULT_POSITION, type Color, type Move, type Square } from 'chess.js';

export type ChessMove = Readonly<{
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
}>;

/** Persist the starting position and accepted moves so repetition survives a reload. */
export type ChessState = Readonly<{
  initialFen: string;
  moves: readonly ChessMove[];
}>;

export type ChessBoardOutcome =
  | { reason: 'checkmate'; winner: Color }
  | { reason: 'stalemate' | 'insufficient-material' | 'threefold-repetition' | 'fifty-move-rule'; winner: null };

export type ChessPosition = {
  fen: string;
  turn: Color;
  inCheck: boolean;
  outcome: ChessBoardOutcome | null;
};

export type ChessMoveResult =
  | { ok: true; state: ChessState; position: ChessPosition; san: string }
  | { ok: false; reason: 'invalid-input' | 'illegal-move' | 'game-finished' };

function isSquare(value: unknown): value is Square {
  return typeof value === 'string' && value.length === 2 && /^[a-h][1-8]$/.test(value);
}

function parseMove(input: unknown): ChessMove | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const { from, to, promotion } = input as Record<string, unknown>;
  if (!isSquare(from) || !isSquare(to)) return null;
  if (promotion === undefined) return { from, to };
  if (promotion !== 'q' && promotion !== 'r' && promotion !== 'b' && promotion !== 'n') return null;
  return { from, to, promotion };
}

function positionKey(board: Chess): string {
  // FEN omits en passant when the capture would expose the king to check.
  return board.fen().split(' ', 4).join(' ');
}

function restoreBoard(state: ChessState) {
  const board = new Chess(state.initialFen);
  const occurrences = new Map<string, number>();
  function countPosition() {
    const key = positionKey(board);
    const count = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, count);
    return count;
  }
  let repetitions = countPosition();
  for (const move of state.moves) {
    board.move(move);
    repetitions = countPosition();
  }
  return { board, repetitions, countPosition };
}

function outcomeOf(board: Chess, repetitions: number): ChessBoardOutcome | null {
  if (board.isCheckmate()) return { reason: 'checkmate', winner: board.turn() === 'w' ? 'b' : 'w' };
  if (board.isStalemate()) return { reason: 'stalemate', winner: null };
  if (board.isInsufficientMaterial()) return { reason: 'insufficient-material', winner: null };
  // FIDE online rules 5.4.1/5.4.4 automatically end play at the lower thresholds.
  if (repetitions >= 3) return { reason: 'threefold-repetition', winner: null };
  if (board.isDrawByFiftyMoves()) return { reason: 'fifty-move-rule', winner: null };
  return null;
}

function positionOf(board: Chess, repetitions: number): ChessPosition {
  return {
    fen: board.fen(),
    turn: board.turn(),
    inCheck: board.isCheck(),
    outcome: outcomeOf(board, repetitions),
  };
}

export function initialChessState(): ChessState {
  return { initialFen: DEFAULT_POSITION, moves: [] };
}

export function inspectChessState(state: ChessState): ChessPosition {
  const { board, repetitions } = restoreBoard(state);
  return positionOf(board, repetitions);
}

/** Use authoritative state. Authorization, clocks and atomic writes belong to the match service. */
export function playChessMove(state: ChessState, input: unknown): ChessMoveResult {
  const move = parseMove(input);
  if (!move) return { ok: false, reason: 'invalid-input' };
  const { board, repetitions, countPosition } = restoreBoard(state);
  if (outcomeOf(board, repetitions)) return { ok: false, reason: 'game-finished' };

  let played: Move;
  try {
    played = board.move(move);
  } catch {
    return { ok: false, reason: 'illegal-move' };
  }
  // chess.js ignores an extraneous promotion on an ordinary move.
  if (played.promotion !== move.promotion) return { ok: false, reason: 'illegal-move' };
  return {
    ok: true,
    state: { initialFen: state.initialFen, moves: [...state.moves, move] },
    position: positionOf(board, countPosition()),
    san: played.san,
  };
}
