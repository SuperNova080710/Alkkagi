export const WIDTH = 800, HEIGHT = 500, RADIUS = 18;
export const MIN_FORCE = 8, MAX_FORCE = 125;
export const IMPULSE_FACTOR = 0.095, FRICTION = 0.973;
const MAX_FRAMES = 800;
export type Piece = { id: string; owner: string; x: number; y: number };
export type Board = { pieces: Piece[] };
export type Shot = { pieceId: string; dx: number; dy: number };
export type Simulation = { board: Board; frames: Board[] };
export function validBoard(value: unknown): value is Board {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const pieces = (value as Board).pieces;
 return Array.isArray(pieces) && pieces.length <= 10 && pieces.every(p => p &&
  typeof p.id === 'string' && typeof p.owner === 'string' &&
  Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x >= 0 && p.x <= WIDTH && p.y >= 0 && p.y <= HEIGHT);
}
export function simulateShot(board: Board, actor: string, shot: Shot): Board {
 return simulateShotWithFrames(board, actor, shot).board;
}
export function simulateShotWithFrames(board: Board, actor: string, shot: Shot): Simulation {
 if (!validBoard(board) || !Number.isFinite(shot.dx) || !Number.isFinite(shot.dy))
  throw Error('INVALID_SHOT');
 const length = Math.hypot(shot.dx, shot.dy);
 if (length < MIN_FORCE || length > MAX_FORCE + 0.0001) throw Error('INVALID_FORCE');
 const target = board.pieces.find(p => p.id === shot.pieceId);
 if (!target || target.owner !== actor) throw Error('NOT_YOUR_PIECE');
 const pieces = board.pieces.map(p => ({ ...p, vx: 0, vy: 0 }));
 const moving = pieces.find(p => p.id === shot.pieceId)!;
 moving.vx = shot.dx * IMPULSE_FACTOR;
 moving.vy = shot.dy * IMPULSE_FACTOR;
 const snapshot = (): Board => ({
  pieces: pieces.map(({ id, owner, x, y }) => ({
   id, owner, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100,
  })),
 });
 const frames: Board[] = [snapshot()];
 for (let frame = 0; frame < MAX_FRAMES; frame++) {
  let active = false;
  for (const p of pieces) {
   p.x += p.vx; p.y += p.vy;
   p.vx *= FRICTION; p.vy *= FRICTION;
   if (Math.abs(p.vx) + Math.abs(p.vy) < 0.07) { p.vx = 0; p.vy = 0; }
   if (p.vx !== 0 || p.vy !== 0) active = true;
  }
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
   const a = pieces[i], b = pieces[j], dx = b.x - a.x, dy = b.y - a.y;
   const d = Math.hypot(dx, dy);
   if (d >= RADIUS * 2 || d < 0.00001) continue;
   const nx = dx / d, ny = dy / d, overlap = (RADIUS * 2 - d) / 2;
   a.x -= nx * overlap; a.y -= ny * overlap;
   b.x += nx * overlap; b.y += ny * overlap;
   const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
   if (approach < 0) {
    const impulse = -(1 + 0.92) * approach / 2;
    a.vx -= impulse * nx; a.vy -= impulse * ny;
    b.vx += impulse * nx; b.vy += impulse * ny;
   }
  }
  for (let i = pieces.length - 1; i >= 0; i--) {
   const p = pieces[i];
   if (p.x < RADIUS || p.x > WIDTH - RADIUS || p.y < RADIUS || p.y > HEIGHT - RADIUS)
    pieces.splice(i, 1);
  }
  if (frame % 6 === 5 || !active) frames.push(snapshot());
  if (!active) break;
 }
 const final = snapshot();
 if (JSON.stringify(frames[frames.length - 1]) !== JSON.stringify(final)) frames.push(final);
 // Bound per-turn payload size while retaining the beginning and final authoritative state.
 if (frames.length > 100) {
  const step = Math.ceil((frames.length - 1) / 98);
  const sampled = frames.filter((_, index) => index % step === 0);
  if (sampled[sampled.length - 1] !== frames[frames.length - 1]) sampled.push(frames[frames.length - 1]);
  return { board: final, frames: sampled };
 }
 return { board: final, frames };
}
export function outcome(board: Board, player1: string, player2: string) {
 const first = board.pieces.some(p => p.owner === player1);
 const second = board.pieces.some(p => p.owner === player2);
 return {
  finished: !first || !second,
  winnerId: !first && second ? player2 : first && !second ? player1 : null,
 };
}
