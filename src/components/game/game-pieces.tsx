import { RADIUS, type Board } from '@/lib/game/engine';

type Props = {
 board: Board;
 firstPlayerId: string;
 viewerId: string;
};

// Own pieces retain their "나" mark, but no extra halo masks the court.
export function GamePieces({board, firstPlayerId, viewerId}: Props) {
 return <>{board.pieces.map(piece => {
  const mine = piece.owner === viewerId;
  return <g key={piece.id} data-piece-owner={mine ? 'mine' : 'opponent'}>
   <circle cx={piece.x + 2} cy={piece.y + 4} r={RADIUS + 1} fill="#000" opacity="0.28"/>
   <circle cx={piece.x} cy={piece.y} r={RADIUS}
    fill={piece.owner === firstPlayerId ? '#f59e0b' : '#60a5fa'}
    stroke={piece.owner === firstPlayerId ? '#fcd34d' : '#93c5fd'} strokeWidth="1.5"/>
   <circle cx={piece.x - 5} cy={piece.y - 5} r="5" fill="#fff" opacity="0.45"/>
   <ellipse cx={piece.x - 5} cy={piece.y - 7} rx="7" ry="3" fill="#fff" opacity="0.45" pointerEvents="none"/>
   {mine && <text x={piece.x} y={piece.y + 4} textAnchor="middle"
    fontSize="11" fontWeight="900" fill="#0f172a"
    style={{ pointerEvents:'none', userSelect:'none' }}>나</text>}
  </g>;
 })}</>;
}
