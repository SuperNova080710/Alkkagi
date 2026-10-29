import Link from 'next/link';
import { ArenaHero, ArenaPanel, ArenaShell } from '@/components/ui/arena';
import type { ReactNode } from 'react';

export type LobbyData = {
  nickname: string;
  rating: number | null;
  leaderboard: { position: number; nickname: string; rating: number }[];
  rankingUnavailable: boolean;
  activeCasual: { id: string; room_id: string }[];
  activeAi: { room_id: string }[];
  recoveryUnavailable: boolean;
};

/** Presentation boundary for backend integration and credential-free visual verification. */
export function LobbyView({ data, modes, account }: { data: LobbyData; modes: ReactNode; account?: ReactNode }) {
  const hasMatches = data.activeCasual.length > 0 || data.activeAi.length > 0;
  return <ArenaShell current="lobby" account={account}>
    <ArenaHero compact />
    <div className="arena-lobby-grid">
      <div className="arena-play-column">{modes}
        <ArenaPanel title="진행 중인 경기" className="arena-recovery">
          {data.recoveryUnavailable && <p role="status" className="arena-muted">진행 중인 경기 일부를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>}
          {!hasMatches && !data.recoveryUnavailable && <p className="arena-muted">진행 중인 경기가 없어요. 새로운 한 판을 시작해 보세요!</p>}
          {hasMatches && <div className="arena-recovery-links">
            {data.activeCasual.map((match, index) => <Link key={match.id} href={`/rooms/${match.room_id}`} className="arena-button arena-button--outline">일반전 {index + 1} 계속하기</Link>)}
            {data.activeAi.map((match, index) => <Link key={match.room_id} href={`/rooms/${match.room_id}/ai`} className="arena-button arena-button--outline">AI 대전 {index + 1} 계속하기</Link>)}
          </div>}
        </ArenaPanel>
      </div>
      <aside className="arena-sidebar" aria-label="내 정보와 랭킹">
        <ArenaPanel title="내 정보">
          <div className="arena-player-summary"><span className="arena-avatar" aria-hidden="true">●</span><div><p className="arena-nickname">{data.nickname}</p><p className="arena-muted">{data.rating === null ? 'RP를 불러오지 못했어요' : `${data.rating.toLocaleString('ko-KR')} RP`}</p></div></div>
          <Link href="/profile" className="arena-text-link">내 프로필 <span aria-hidden="true">›</span></Link>
        </ArenaPanel>
        <ArenaPanel title="랭킹 TOP 3">
          {data.rankingUnavailable ? <p role="status" className="arena-muted">랭킹을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p> : data.leaderboard.length ? <ol className="arena-leaderboard">{data.leaderboard.slice(0, 3).map(player => <li key={player.position}><span className="arena-rank-number">{player.position}</span><span className="arena-rank-name">{player.nickname}</span><strong>{player.rating.toLocaleString('ko-KR')}<small> RP</small></strong></li>)}</ol> : <p className="arena-muted">아직 등록된 순위가 없어요.</p>}
          <Link href="/ranked" className="arena-text-link">전체 랭킹 보기 <span aria-hidden="true">›</span></Link>
        </ArenaPanel>
        <div className="arena-future"><span>친구 <small>준비 중</small></span><span>꾸미기 <small>준비 중</small></span></div>
      </aside>
    </div>
  </ArenaShell>;
}
