import type { ReactNode } from 'react';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { RankedLayout, RankedLeaderboard } from './ranked-layout';
import { GameSwitcher, type ArenaGame } from '@/components/lobby/game-switcher';
export type RankedDashboard = {
  rating: number; rank: number; wins: number; losses: number; draws: number;
  leaderboard: { position: number; nickname: string; rating: number }[];
  history: { matchId: string; finished_at: string; opponent: string; result: string; delta: number | null; ratingAfter: number | null }[];
};
export function RankedView({ nickname, dashboard, queue, game = 'alkkagi' }: {
  nickname: string; dashboard: RankedDashboard | null; queue: ReactNode; game?: ArenaGame;
}) {
  return <ArenaShell current="ranked" game={game}><div className="arena-service arena-service--ranked">
    {(process.env.OMOK_UI_ENABLED === 'true' || process.env.CHESS_UI_ENABLED === 'true') &&
      <GameSwitcher current={game} section="ranked" omokEnabled={process.env.OMOK_UI_ENABLED === 'true'}/>}
    <RankedLayout nickname={nickname} kicker={game === 'chess' ? 'CHESS · RANKED ARENA' : 'RANKED ARENA'}
      description={<>승리하면 RP를 얻고, 패배하면 RP가 줄어듭니다.<br/>일반전과 AI 연습전은 순위에 영향을 주지 않아요.</>}
      error={dashboard ? undefined : '랭킹 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'}
      queue={queue}
      stats={<>
        <ArenaPanel title="나의 RP"><p>{dashboard ? dashboard.rating.toLocaleString('ko-KR') : '—'}<small> RP</small></p></ArenaPanel>
        <ArenaPanel title="전체 순위"><p>{dashboard && dashboard.rank > 0 ? `#${dashboard.rank}` : '—'}</p></ArenaPanel>
        <ArenaPanel title="랭크 전적"><p>{dashboard ? `${dashboard.wins}승 · ${dashboard.losses}패 · ${dashboard.draws}무` : '—'}</p></ArenaPanel>
      </>}
    >
      <ArenaPanel title="리더보드 TOP 100">
        <RankedLeaderboard rows={dashboard?.leaderboard ?? []}
          caption="전체 랭크 순위, 닉네임과 RP"
          emptyMessage={dashboard ? '아직 등록된 순위가 없어요.' : undefined}/>
      </ArenaPanel>
      <ArenaPanel title="최근 랭크 경기">
        {dashboard && !dashboard.history.length && <p className="arena-muted">아직 랭크 경기 기록이 없습니다.</p>}
        <ol className="arena-history">{(dashboard?.history ?? []).map(item => <li key={item.matchId}><div><strong>{item.opponent}</strong><span className={`arena-outcome arena-outcome--${item.result}`}>{item.result === 'win' ? '승리' : item.result === 'loss' ? '패배' : '무승부'}</span></div><p>RP {item.delta === null ? '정산 확인 중' : `${item.delta >= 0 ? '+' : ''}${item.delta}`} · {new Date(item.finished_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</p></li>)}</ol>
      </ArenaPanel>
    </RankedLayout>
  </div></ArenaShell>;
}
