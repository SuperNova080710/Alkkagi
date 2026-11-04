'use client';

import { useEffect, useRef } from 'react';
import './omok-result-parity.css';

export type OmokOutcome = '승리' | '패배' | '무승부';
export type OmokResultOverlayProps = {
  outcome: OmokOutcome;
  mode: 'casual' | 'ranked' | 'ai';
  finishReason?: string | null;
  pending?: boolean;
  error?: string | null;
  onReplay?: () => void;
  onReturn?: () => void;
  myRematchVote?: boolean;
  rematchReadyCount?: number;
};
const descriptions: Record<OmokOutcome,string> = {
  '승리': '상대방을 이겼습니다.',
  '패배': '상대방이 승리했습니다.',
  '무승부': '서로 비겼습니다.',
};
const reasonLabels: Record<string,string> = {
  five: '다섯 목 완성',
  draw: '무승부',
  timeout: '시간 초과',
  forfeit: '기권',
};
/** Shares Alkkagi's result-card visual language; the server owns the outcome. */
export function OmokResultOverlay({
  outcome, mode, finishReason, pending = false, error, onReplay, onReturn,
  myRematchVote = false, rematchReadyCount = 0,
}: OmokResultOverlayProps) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { card.current?.focus({ preventScroll: true }); }, []);
  const emphasis = outcome === '승리' ? 'text-emerald-300'
    : outcome === '패배' ? 'text-rose-300' : 'text-amber-200';
  const replayLabel = mode === 'casual'
    ? myRematchVote ? '상대 수락 대기 중' : '재도전 · 다시하기'
    : mode === 'ranked' ? '재도전 · 새 랭크 매칭'
      : '다시하기 · 난이도 선택';
  return <div className="game-result-overlay arena-omok-result-overlay absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3"
    aria-label="오목 경기 결과">
    <div ref={card} tabIndex={-1}
      className="game-result-card w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-950/95 p-5 text-center shadow-2xl sm:p-6"
      role="status" aria-live="polite">
      <p className="text-xs font-bold tracking-[0.2em] text-slate-400">MATCH RESULT</p>
      <h3 className={'mt-2 text-4xl font-black ' + emphasis}>{outcome}</h3>
      <p className="mt-2 text-sm text-slate-300">{descriptions[outcome]}</p>
      {finishReason && <p className="mt-2 text-xs text-slate-400">
        종료 사유 · {reasonLabels[finishReason] ?? finishReason}
      </p>}
      {mode === 'casual' && onReplay && <p className="mt-3 text-xs text-slate-400">
        양쪽 모두 수락하면 재대전 · {Math.min(2, Math.max(0, rematchReadyCount))}/2
      </p>}
      {mode === 'ranked' && <p className="mt-3 text-xs text-slate-400">
        오목 RP 정산은 서버 기록을 기준으로 경기 현황에 표시됩니다.
      </p>}
      <div className="mt-4 flex flex-col gap-2">
        {onReturn && <button className="rounded-xl border border-slate-500 px-4 py-2.5 text-sm font-semibold text-slate-100"
          type="button" onClick={onReturn}>로비로 돌아가기</button>}
        {onReplay && <button className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
          type="button" aria-label={mode === 'casual' ? '재대결 신청' : undefined}
          onClick={onReplay} disabled={pending || myRematchVote}>
          {pending ? '요청 중…' : replayLabel}
        </button>}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
    </div>
  </div>;
}
