import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
export type RankedDashboard = {
  rating: number; rank: number; wins: number; losses: number; draws: number;
  leaderboard: { position: number; nickname: string; rating: number }[];
  history: { matchId: string; finished_at: string; opponent: string; result: string; delta: number | null; ratingAfter: number | null }[];
};
export function RankedView({ nickname, dashboard, queue }: { nickname: string; dashboard: RankedDashboard | null; queue: ReactNode }) {
  return <ArenaShell current="ranked"><div className="arena-service">
    <header className="arena-service-heading"><div><p className="arena-section-kicker">RANKED ARENA</p><h1>한 판씩, 더 높은 곳으로.</h1><p>승리하면 RP를 얻고, 패배하면 RP가 줄어듭니다.<br/>일반전과 AI 연습전은 순위에 영향을 주지 않아요.</p></div><Image src="/art/ranked.webp" width={150} height={150} alt="" /></header>
    <div className="arena-service-name"><strong>{nickname}</strong><Link href="/profile">내 프로필 <span aria-hidden="true">›</span></Link></div>
    {!dashboard && <p role="alert" className="arena-service-alert">랭킹 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
    <div className="arena-stats">
      <ArenaPanel title="나의 RP"><p>{dashboard ? dashboard.rating.toLocaleString('ko-KR') : '—'}<small> RP</small></p></ArenaPanel>
      <ArenaPanel title="전체 순위"><p>{dashboard && dashboard.rank > 0 ? `#${dashboard.rank}` : '—'}</p></ArenaPanel>
      <ArenaPanel title="랭크 전적"><p>{dashboard ? `${dashboard.wins}승 · ${dashboard.losses}패 · ${dashboard.draws}무` : '—'}</p></ArenaPanel>
    </div>
    <div className="arena-service-controls">{queue}</div>
    <div className="arena-ranking-grid">
      <ArenaPanel title="리더보드 TOP 100">
        <div className="arena-table-scroll"><table><caption className="sr-only">전체 랭크 순위, 닉네임과 RP</caption><thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">RP</th></tr></thead><tbody>
          {(dashboard?.leaderboard ?? []).map(player => <tr key={player.position}><td><span className="arena-rank-number">{player.position}</span></td><td>{player.nickname}</td><td>{player.rating.toLocaleString('ko-KR')}</td></tr>)}
        </tbody></table></div>
        {dashboard && !dashboard.leaderboard.length && <p className="arena-muted">아직 등록된 순위가 없어요.</p>}
      </ArenaPanel>
      <ArenaPanel title="최근 랭크 경기">
        {dashboard && !dashboard.history.length && <p className="arena-muted">아직 랭크 경기 기록이 없습니다.</p>}
        <ol className="arena-history">{(dashboard?.history ?? []).map(item => <li key={item.matchId}><div><strong>{item.opponent}</strong><span className={`arena-outcome arena-outcome--${item.result}`}>{item.result === 'win' ? '승리' : item.result === 'loss' ? '패배' : '무승부'}</span></div><p>RP {item.delta === null ? '정산 확인 중' : `${item.delta >= 0 ? '+' : ''}${item.delta}`} · {new Date(item.finished_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</p></li>)}</ol>
      </ArenaPanel>
    </div>
  </div></ArenaShell>;
}
