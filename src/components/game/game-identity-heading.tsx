import { getTurnMessage, type DisplayPlayer, type IdentityMatch } from '@/lib/game/player-identity';

type Props = {
 match: IdentityMatch;
 viewerId: string;
 players: [DisplayPlayer, DisplayPlayer];
 mode: 'casual' | 'ranked';
 animating: boolean;
 pending: boolean;
 remaining: number | null;
};

export function GameIdentityHeading({
 match, viewerId, players, mode, animating, pending, remaining,
}: Props) {
 const message = getTurnMessage(match, viewerId, players, { animating, pending, remaining });
 return <div className="game-screen-heading flex items-center justify-between gap-3">
  <div className="game-identity-announcement min-w-0 flex-1">
   <h2 className="text-lg font-extrabold sm:text-xl">{mode === 'ranked' ? '랭크 대전' : '알까기 대전'}</h2>
   <p className="mt-1 truncate text-sm font-bold text-emerald-200" role="status" aria-live="polite"
    aria-atomic="true" title={message}>{message}</p>
  </div>
  <div className="game-player-strip flex min-w-0 gap-2" aria-label="내 알과 상대방, 현재 턴">
   {players.map(player => {
    const turnBadge = player.isTurn ? (animating ? '다음 턴' : '현재 턴') : '대기';
    const seat = player.seat === 1 ? '선공' : '후공';
    return <div key={player.id}
     className={'game-player-card min-w-0 rounded-xl border px-3 py-2 ' +
      (player.isTurn ? 'game-player-card--turn ' : '') +
      (player.isMe ? 'game-player-card--mine' : 'border-slate-700 bg-slate-900/80')}
     aria-label={`${player.isMe ? '내 알' : '상대 알'}: ${player.nickname}, ${player.colorName}, ${seat}, ${player.startSide} 시작, ${player.remaining}개 남음, ${turnBadge}`}>
     <div className="flex items-center gap-1.5 text-xs font-bold">
      <span className="game-player-dot shrink-0" style={{ backgroundColor: player.color }}/>
      <span className="truncate">{player.isMe ? '내 알' : '상대 알'} · {player.colorName} · {seat}</span>
     </div>
     <div className="mt-0.5 flex items-center justify-between gap-1">
      <span className="truncate text-sm font-bold" title={player.nickname}>{player.nickname}</span>
      <span className={'game-turn-chip shrink-0 text-[10px] font-bold ' +
       (player.isTurn ? 'text-emerald-200' : 'text-slate-400')}>
       {turnBadge}
      </span>
     </div>
     <p className="text-[11px] text-slate-300">{player.startSide} 시작 · {player.remaining}개</p>
    </div>;
   })}
  </div>
 </div>;
}
