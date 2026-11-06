import Link from 'next/link';
import '@/components/lobby/lobby-size-parity.css';
// Direct rendering (including QA) must load Omok art positioning just like /omok.
import './omok-parity.css';
import type { ReactNode } from 'react';
import { ArenaHero, ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { GameSwitcher } from '@/components/lobby/game-switcher';
import { OmokLobbyModes } from './omok-lobby-modes';
import { LobbyRecoveryInline } from '@/components/lobby/lobby-recovery-inline';
import { LobbyIdentitySummary } from '@/components/lobby/lobby-identity-summary';

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
export function OmokLobbyView({ data, account, friendsEnabled = false, cosmeticsEnabled = false, experienceEnabled = false }: {
  data: OmokLobbyData; account?: ReactNode; friendsEnabled?: boolean; cosmeticsEnabled?: boolean;
  experienceEnabled?: boolean;
}) {
  const hasMatches = data.activeCasual.length > 0 || data.activeAi.length > 0;
  return <ArenaShell current="lobby" game="omok" account={account}>
    <ArenaHero compact game="omok"/>
    <div className="arena-lobby-grid arena-lobby-grid--multigame arena-omok-lobby-grid">
      <div className="arena-play-column">
        <GameSwitcher current="omok"/>
        <OmokLobbyModes/>
        <LobbyRecoveryInline hasMatches={hasMatches} unavailable={data.recoveryUnavailable}>
          {data.activeCasual.map((match, index) => <Link key={match.id}
            className="arena-button arena-button--outline"
            href={match.mode === 'ranked' ? `/omok/ranked/matches/${match.id}` : `/omok/matches/${match.id}`}>
            {match.mode === 'ranked' ? '랭크전' : '일반전'} {index + 1} 계속하기
          </Link>)}
          {data.activeAi.map((match, index) => <Link key={match.id}
            className="arena-button arena-button--outline"
            href={`/omok/ai/${match.id}`}>
            AI 대전 {index + 1} 계속하기
          </Link>)}
        </LobbyRecoveryInline>
      </div>
      <aside className="arena-sidebar" aria-label="오목 내 정보와 랭킹">
        <ArenaPanel title="내 정보">
          <LobbyIdentitySummary nickname={data.nickname} rating={data.rating} game="omok"
            experienceEnabled={experienceEnabled} cosmeticsEnabled={cosmeticsEnabled}/>
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
