import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaLobbyLayout, type LobbySummary } from '@/components/lobby/arena-lobby-layout';
import { LobbyRecoveryInline } from '@/components/lobby/lobby-recovery-inline';
import { OmokLobbyModes } from './omok-lobby-modes';
// Direct rendering (including QA) must load Omok art positioning just like /omok.
import './omok-parity.css';

export type OmokLobbyData = LobbySummary & {
  activeCasual: { id: string; room_id: string | null; mode: string }[];
  activeAi: { id: string }[];
  recoveryUnavailable: boolean;
};

export function OmokLobbyView({ data, account, friendsEnabled, cosmeticsEnabled, experienceEnabled }: {
  data: OmokLobbyData; account?: ReactNode; friendsEnabled?: boolean; cosmeticsEnabled?: boolean;
  experienceEnabled?: boolean;
}) {
  const hasMatches = data.activeCasual.length > 0 || data.activeAi.length > 0;
  return <ArenaLobbyLayout game="omok" data={data} modes={<OmokLobbyModes/>} account={account}
    showGameSwitcher friendsEnabled={friendsEnabled}
    cosmeticsEnabled={cosmeticsEnabled} experienceEnabled={experienceEnabled}
    recovery={<LobbyRecoveryInline hasMatches={hasMatches} unavailable={data.recoveryUnavailable}>
      {data.activeCasual.map((match, index) => <Link key={match.id}
        className="arena-button arena-button--outline"
        href={match.mode === 'ranked' ? `/omok/ranked/matches/${match.id}` : `/omok/matches/${match.id}`}>
        {match.mode === 'ranked' ? '랭크전' : '일반전'} {index + 1} 계속하기
      </Link>)}
      {data.activeAi.map((match, index) => <Link key={match.id}
        className="arena-button arena-button--outline" href={`/omok/ai/${match.id}`}>
        AI 대전 {index + 1} 계속하기
      </Link>)}
    </LobbyRecoveryInline>}
  />;
}
