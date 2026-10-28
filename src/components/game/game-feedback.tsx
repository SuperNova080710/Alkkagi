import { MAX_FORCE } from '@/lib/game/engine';

type Props = { power: number | null; pending: boolean; error: string };

/**
 * Reserve BOTH feedback rows even when no shot is being dragged or processed.
 * Without these slots the flex-sized SVG court changes height on every turn.
 */
export function GameFeedback({ power, pending, error }: Props) {
 const dragging = power !== null;
 const strength = Math.round(Math.min(MAX_FORCE, Math.max(0, power ?? 0)) / MAX_FORCE * 100);
 return <div className="game-shot-feedback mt-1">
  <div className="game-shot-power flex gap-3 text-xs text-amber-200"
   aria-hidden={!dragging} style={{ visibility: dragging ? 'visible' : 'hidden' }}>
   <span className="min-w-16">세기 {strength}%</span>
   <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-700">
    <div className="h-full rounded-full bg-amber-300" style={{ width: strength + '%' }}/>
   </div>
  </div>
  <p className="game-shot-status text-xs text-amber-200"
   role={error ? 'alert' : pending ? 'status' : undefined} title={error || undefined}>
   {error || (pending ? '서버에서 판정 중입니다…' : '\u00a0')}
  </p>
 </div>;
}
