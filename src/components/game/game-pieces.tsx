import { useId } from 'react';
import { RADIUS, type Board } from '@/lib/game/engine';
import { safeCosmeticCode } from '@/components/cosmetics/cosmetic-api';
import type { MatchCosmeticLooks } from './use-match-cosmetics';

type Props = {
 board: Board;
 firstPlayerId: string;
 viewerId: string;
 cosmetics?: MatchCosmeticLooks;
};

/** Cosmetic strokes and marks do not participate in hit testing or game engine input. */
export function GamePieces({board, firstPlayerId, viewerId, cosmetics}: Props) {
 const id = useId();
 return <>
  <defs aria-hidden="true">
   <radialGradient id={id+'-forest'} cx="30%" cy="23%" r="85%">
    <stop offset="0" stopColor="#b4f4ad"/>
    <stop offset=".46" stopColor="#3fba78"/>
    <stop offset="1" stopColor="#165a3f"/>
   </radialGradient>
   <radialGradient id={id+'-starlight'} cx="27%" cy="20%" r="85%">
    <stop offset="0" stopColor="#fff7d6"/>
    <stop offset=".46" stopColor="#b8a0f5"/>
    <stop offset="1" stopColor="#4e438d"/>
   </radialGradient>
  </defs>
  {board.pieces.map(piece => {
   const mine = piece.owner === viewerId;
   const first = piece.owner === firstPlayerId;
   const skin = safeCosmeticCode(cosmetics?.[piece.owner]?.pieceCode ?? '', 'piece');
   const fill = skin === 'piece-forest' ? `url(#${id}-forest)` :
    skin === 'piece-starlight' ? `url(#${id}-starlight)` :
    first ? '#f59e0b' : '#60a5fa';
   // Keeping the original seat-color border identifies teams even when skins match.
   return <g key={piece.id} data-piece-owner={mine ? 'mine' : 'opponent'}
    data-piece-skin={skin}>
    <circle cx={piece.x + 2} cy={piece.y + 4} r={RADIUS + 1} fill="#000" opacity="0.28"/>
    <circle cx={piece.x} cy={piece.y} r={RADIUS} fill={fill}
     stroke={first ? '#fcd34d' : '#93c5fd'} strokeWidth="1.5"/>
    <circle cx={piece.x - 5} cy={piece.y - 5} r="5" fill="#fff" opacity="0.45"/>
    <ellipse cx={piece.x - 5} cy={piece.y - 7} rx="7" ry="3" fill="#fff" opacity="0.45" pointerEvents="none"/>
    {skin === 'piece-forest' && <path
     d={`M${piece.x-5} ${piece.y+4} Q${piece.x+5} ${piece.y-9} ${piece.x+9} ${piece.y-7} Q${piece.x+6} ${piece.y+5} ${piece.x-5} ${piece.y+4}Z`}
     fill="#e0ffd1" fillOpacity=".76" pointerEvents="none"/>}
    {skin === 'piece-starlight' && <path
     d={`M${piece.x+5} ${piece.y-9}l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z`}
     fill="#fff8c6" fillOpacity=".9" pointerEvents="none"/>}
    {mine && <text x={piece.x} y={piece.y + 4} textAnchor="middle"
     fontSize="11" fontWeight="900" fill="#0f172a"
     style={{ pointerEvents:'none', userSelect:'none' }}>나</text>}
   </g>;
  })}
 </>;
}
