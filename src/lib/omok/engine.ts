/**
 * 15×15 freestyle Gomoku domain engine.
 *
 * This module is pure: persistence, authentication, time limits, and
 * concurrent-turn protection are enforced by the server/DB integration.
 */
export const OMOK_SIZE = 15;
export type Stone = 'black' | 'white';
export type Cell = Stone | null;
export type OmokBoard = Cell[][];
export type OmokMove = { row: number; col: number };
export type OmokState = {
  board: OmokBoard;
  next: Stone;
  moves: number;
  status: 'active' | 'finished';
  winner: Stone | null;
};
export type OmokResult = { state: OmokState; result: 'continue' | 'win' | 'draw' };
const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

export function emptyOmokBoard(): OmokBoard {
  return Array.from({ length: OMOK_SIZE }, () => Array<Cell>(OMOK_SIZE).fill(null));
}

export function initialOmokState(): OmokState {
  return { board: emptyOmokBoard(), next: 'black', moves: 0, status: 'active', winner: null };
}

export function validOmokBoard(value: unknown): value is OmokBoard {
  return Array.isArray(value) && value.length === OMOK_SIZE &&
    value.every(row => Array.isArray(row) && row.length === OMOK_SIZE &&
      row.every(cell => cell === null || cell === 'black' || cell === 'white'));
}

/** A single bounded scan detects finished lines without repeatedly validating the board. */
function boardHasFive(board: OmokBoard, stone: Stone): boolean {
  for (let r = 0; r < OMOK_SIZE; r++) {
    for (let c = 0; c < OMOK_SIZE; c++) {
      if (board[r][c] !== stone) continue;
      for (const [dr, dc] of directions) {
        // Only scan the first stone in each run.
        const beforeR = r - dr, beforeC = c - dc;
        if (beforeR >= 0 && beforeR < OMOK_SIZE &&
            beforeC >= 0 && beforeC < OMOK_SIZE &&
            board[beforeR][beforeC] === stone) continue;
        let length = 1, row = r + dr, col = c + dc;
        while (row >= 0 && row < OMOK_SIZE && col >= 0 && col < OMOK_SIZE &&
               board[row][col] === stone) {
          length++;
          if (length >= 5) return true;
          row += dr; col += dc;
        }
      }
    }
  }
  return false;
}

export function validOmokState(value: unknown): value is OmokState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<OmokState>;
  if (!validOmokBoard(state.board)) return false;
  if (state.next !== 'black' && state.next !== 'white') return false;
  if (typeof state.moves !== 'number' || !Number.isInteger(state.moves) || state.moves < 0 || state.moves > OMOK_SIZE ** 2) return false;
  if (state.status !== 'active' && state.status !== 'finished') return false;
  if (state.winner !== null && state.winner !== 'black' && state.winner !== 'white') return false;
  if (state.status === 'active' && state.winner !== null) return false;
  if (state.board.flat().filter(cell => cell !== null).length !== state.moves) return false;
  const black = state.board.flat().filter(cell => cell === 'black').length;
  const white = state.moves - black;
  if (!(black === white || black === white + 1)) return false;
  if (state.next !== (black === white ? 'black' : 'white')) return false;
  if (state.winner !== null && (state.winner === 'black' ? black !== white + 1 : black !== white)) return false;
  // Terminal metadata must correspond to the actual 225-cell position.
  // A finished draw requires a full board with no line; a win requires the
  // recorded winner's line. Neither color may already have five during play.
  const blackWon = boardHasFive(state.board, 'black');
  const whiteWon = boardHasFive(state.board, 'white');
  if (blackWon && whiteWon) return false;
  if (state.status === 'active') return state.moves < OMOK_SIZE ** 2 && !blackWon && !whiteWon;
  if (state.winner === null)
    return state.moves === OMOK_SIZE ** 2 && !blackWon && !whiteWon;
  return state.winner === 'black' ? blackWon && !whiteWon : whiteWon && !blackWon;
}

export function hasFive(board: OmokBoard, row: number, col: number, stone: Stone): boolean {
  if (!validOmokBoard(board) || !Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || row >= OMOK_SIZE || col < 0 || col >= OMOK_SIZE || board[row][col] !== stone) {
    return false;
  }
  for (const [dr, dc] of directions) {
    let count = 1;
    for (const direction of [-1, 1]) {
      let r = row + dr * direction, c = col + dc * direction;
      while (r >= 0 && r < OMOK_SIZE && c >= 0 && c < OMOK_SIZE && board[r][c] === stone) {
        count++; r += dr * direction; c += dc * direction;
      }
    }
    if (count >= 5) return true; // Freestyle: overlines are wins.
  }
  return false;
}

/**
 * Return a new immutable snapshot or throw a stable validation error.
 * Do not treat the client-supplied state as authoritative on the server.
 */
export function playOmokMove(state: OmokState, stone: Stone, move: OmokMove): OmokResult {
  if (!validOmokState(state)) throw Error('INVALID_BOARD');
  if (state.status !== 'active') throw Error('MATCH_FINISHED');
  if (stone !== 'black' && stone !== 'white') throw Error('INVALID_STONE');
  if (stone !== state.next) throw Error('NOT_YOUR_TURN');
  if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col) ||
      move.row < 0 || move.row >= OMOK_SIZE || move.col < 0 || move.col >= OMOK_SIZE) {
    throw Error('INVALID_MOVE');
  }
  if (state.board[move.row][move.col] !== null) throw Error('CELL_OCCUPIED');
  const board = state.board.map(row => [...row]);
  board[move.row][move.col] = stone;
  const moves = state.moves + 1;
  const winner = hasFive(board, move.row, move.col, stone) ? stone : null;
  const finished = winner !== null || moves === OMOK_SIZE ** 2;
  const next = stone === 'black' ? 'white' : 'black';
  return {
    state: { board, moves, next, status: finished ? 'finished' : 'active', winner },
    result: winner ? 'win' : finished ? 'draw' : 'continue',
  };
}
