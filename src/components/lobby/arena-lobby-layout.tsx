import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaHero, ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { GameSwitcher, type ArenaGame } from './game-switcher';
import { LobbyIdentitySummary } from './lobby-identity-summary';
import './lobby-size-parity.css';

export type LobbySummary = {
  nickname: string;
  rating: number | null;
  leaderboard: { position: number; nickname: string; rating: number }[];
  rankingUnavailable: boolean;
};

type ArenaLobbyLayoutProps = {
  game: ArenaGame;
  data: LobbySummary;
  modes: ReactNode;
  recovery: ReactNode;
  account?: ReactNode;
  showGameSwitcher: boolean;
  friendsEnabled?: boolean;
  cosmeticsEnabled?: boolean;
  experienceEnabled?: boolean;
};

export function ArenaLobbyLayout({
  game, data, modes, recovery, account, showGameSwitcher,
  friendsEnabled = false, cosmeticsEnabled = false, experienceEnabled = false,
}: ArenaLobbyLayoutProps) {
  const omok = game === 'omok';
  return <ArenaShell current="lobby" game={game} account={account}>
    <ArenaHero compact game={game}/>
    <div className={`arena-lobby-grid${showGameSwitcher ? ' arena-lobby-grid--multigame' : ''}`}>
      <div className="arena-play-column">
        {showGameSwitcher && <GameSwitcher current={game}/>}
        {modes}
        {recovery}
      </div>
      <aside className="arena-sidebar" aria-label={omok ? '오목 내 정보와 랭킹' : '내 정보와 랭킹'}>
        <ArenaPanel title="내 정보">
          <LobbyIdentitySummary nickname={data.nickname} rating={data.rating} game={game}
            experienceEnabled={experienceEnabled} cosmeticsEnabled={cosmeticsEnabled}/>
          <Link href="/profile" className="arena-text-link">내 프로필 <span aria-hidden="true">›</span></Link>
        </ArenaPanel>
        <ArenaPanel title={omok ? '오목 랭킹 TOP 3' : '랭킹 TOP 3'}>
          {data.rankingUnavailable
            ? <p role="status" className="arena-muted">{omok ? '오목 ' : ''}랭킹을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
            : data.leaderboard.length
              ? <ol className="arena-leaderboard">{data.leaderboard.slice(0, 3).map(player =>
                <li key={player.position}>
                  <span className="arena-rank-number">{player.position}</span>
                  <span className="arena-rank-name">{player.nickname}</span>
                  <strong>{player.rating.toLocaleString('ko-KR')}<small> RP</small></strong>
                </li>,
              )}</ol>
              : <p className="arena-muted">{omok ? '아직 오목 순위가 없어요.' : '아직 등록된 순위가 없어요.'}</p>}
          <Link href={omok ? '/omok/ranked' : '/ranked'} className="arena-text-link">
            {omok ? '오목 ' : ''}전체 랭킹 보기 <span aria-hidden="true">›</span>
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
