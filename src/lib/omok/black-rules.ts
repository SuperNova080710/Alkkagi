import { OMOK_SIZE, type OmokBoard, type OmokMove } from './engine';

const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
type BlackMoveResult = 'five' | 'overline' | 'double_four' | 'double_three' | null;

function axisLine(board: OmokBoard, row: number, col: number, dr: number, dc: number) {
  let line = '';
  for (let offset = -5; offset <= 5; offset++) {
    const r = row + dr * offset;
    const c = col + dc * offset;
    if (r < 0 || r >= OMOK_SIZE || c < 0 || c >= OMOK_SIZE) {
      line += 'x';
    } else {
      const cell = board[r][c];
      line += cell === 'black' ? 'b' : cell === null ? '.' : 'x';
    }
  }
  return line;
}

function runLength(line: string) {
  let first = 5;
  let last = 5;
  while (line[first - 1] === 'b') first--;
  while (line[last + 1] === 'b') last++;
  return last - first + 1;
}

/** AI lookahead mirrors the SQL referee. The caller has already placed a black stone. */
export function blackMoveResult(board: OmokBoard, { row, col }: OmokMove): BlackMoveResult {
  const lines = directions.map(([dr, dc]) => axisLine(board, row, col, dr, dc));
  const runs = lines.map(runLength);
  if (runs.includes(5)) return 'five';
  if (runs.some(run => run > 5)) return 'overline';

  const fours = new Set<string>();
  const threes = new Map<string, OmokMove[]>();
  for (const [axis, line] of lines.entries()) {
    for (let start = 1; start <= 5; start++) {
      const segment = line.slice(start, start + 5);
      if (!/^[b.]{5}$/.test(segment) || segment.replaceAll('b', '').length !== 1 ||
        line[start - 1] === 'b' || line[start + 5] === 'b') continue;
      fours.add(axis + ':' + segment.padStart(start + 5, '.').padEnd(11, '.'));
      if (fours.size === 2) return 'double_four';
    }

    for (let start = 2; start <= 5; start++) {
      const segment = line.slice(start, start + 4);
      if (!/^[b.]{4}$/.test(segment) || segment.replaceAll('b', '').length !== 1 ||
        line[start - 1] !== '.' || line[start + 4] !== '.' ||
        line[start - 2] === 'b' || line[start + 5] === 'b') continue;
      const key = axis + ':' + segment.padStart(start + 4, '.').padEnd(11, '.');
      const delta = start + segment.indexOf('.') - 5;
      const [dr, dc] = directions[axis];
      const extensions = threes.get(key) ?? [];
      extensions.push({ row: row + dr * delta, col: col + dc * delta });
      threes.set(key, extensions);
    }
  }

  if (threes.size < 2) return null;
  let legalThrees = 0;
  for (const extensions of threes.values()) {
    for (const move of extensions) {
      board[move.row][move.col] = 'black';
      const result = blackMoveResult(board, move);
      board[move.row][move.col] = null;
      if (result !== null) continue;
      legalThrees++;
      if (legalThrees === 2) return 'double_three';
      break;
    }
  }
  return null;
}
