import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaHero, ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { GameSwitcher } from '@/components/lobby/game-switcher';
import { OmokLobbyModes } from './omok-lobby-modes';

export type OmokLobbyData = {
  nickname: string;
  rating: number | null;
  leaderboard: { position: number; nickname: string; rating: number }[];
  rankingUnavailable: boolean;
  activeCasual: { id: string; room_id: string | null; mode: string }[];
  activeAi: { id: string }[];
  recoveryUnavailable: boolean;
};

/** Same 3:1 lobby layout as Alkkagi, with Omok-specific data/links. */
export function OmokLobbyView({ data, account, friendsEnabled = false, cosmeticsEnabled = false }: {
  data: OmokLobbyData; account?: ReactNode; friendsEnabled?: boolean; cosmeticsEnabled?: boolean;
}) {
  const hasMatches = data.activeCasual.length > 0 || data.activeAi.length > 0;
  return <ArenaShell current="lobby" account={account}>
    <ArenaHero compact game="omok">
      <p className="arena-omok-hero-quicknote">
        OMOK ARENA · 15×15 · 검은 돌부터 시작하며 가로·세로·대각선으로 다섯 개 이상 연결하면 승리합니다.
      </p>
    </ArenaHero>
    <div className="arena-lobby-grid arena-lobby-grid--multigame arena-omok-lobby-grid">
      <div className="arena-play-column">
        <GameSwitcher current="omok"/>
        <OmokLobbyModes/>
        <ArenaPanel title="진행 중인 경기" className="arena-recovery">
          {data.recoveryUnavailable &&
            <p role="status" className="arena-muted">오목 진행 중인 경기를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>}
          {!hasMatches && !data.recoveryUnavailable &&
            <p className="arena-muted">진행 중인 오목 경기가 없어요. 새로운 한 판을 시작해 보세요!</p>}
          {hasMatches && <div className="arena-recovery-links">
            {data.activeCasual.map((match, index) =>
              <Link key={match.id} className="arena-button arena-button--outline"
                href={match.mode === 'ranked' ? `/omok/ranked/matches/${match.id}` : `/omok/matches/${match.id}`}>
                {match.mode === 'ranked' ? '랭크전' : '일반전'} {index + 1} 계속하기
              </Link>)}
            {data.activeAi.map((match, index) =>
              <Link key={match.id} className="arena-button arena-button--outline"
                href={`/omok/ai/${match.id}`}>AI 대전 {index + 1} 계속하기</Link>)}
          </div>}
        </ArenaPanel>
      </div>
      <aside className="arena-sidebar" aria-label="오목 내 정보와 랭킹">
        <ArenaPanel title="내 정보">
          <div className="arena-player-summary">
            <span className="arena-avatar arena-avatar--omok" aria-hidden="true">●</span>
            <div className="arena-player-summary-copy">
              <p className="arena-nickname">{data.nickname}</p>
              <p className="arena-muted">{data.rating === null
                ? '오목 RP를 불러오지 못했어요'
                : `${data.rating.toLocaleString('ko-KR')} 오목 RP`}</p>
            </div>
          </div>
          <Link href="/profile" className="arena-text-link">내 프로필 <span aria-hidden="true">›</span></Link>
        </ArenaPanel>
        <ArenaPanel title="오목 랭킹 TOP 3">
          {data.rankingUnavailable
            ? <p role="status" className="arena-muted">오목 랭킹을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
            : data.leaderboard.length
              ? <ol className="arena-leaderboard">{data.leaderboard.slice(0, 3).map(player =>
                <li key={player.position}>
                  <span className="arena-rank-number">{player.position}</span>
                  <span className="arena-rank-name">{player.nickname}</span>
                  <strong>{player.rating.toLocaleString('ko-KR')}<small> RP</small></strong>
                </li>,
              )}</ol>
              : <p className="arena-muted">아직 오목 순위가 없어요.</p>}
          <Link href="/omok/ranked" className="arena-text-link">
            오목 전체 랭킹 보기 <span aria-hidden="true">›</span>
          </Link>
        </ArenaPanel>
        <div className="arena-future">
          {friendsEnabled
            ? <Link href="/friends">친구 <small>친구 목록으로 ›</small></Link>
            : <span>친구 <small>준비 중</small></span>}
          {cosmeticsEnabled
            ? <Link href="/cosmetics">꾸미기 <small>아이템 관리하기 ›</small></Link>
            : <span>꾸미기 <small>준비 중</small></span>}
        </div>
      </aside>
    </div>
  </ArenaShell>;
}
