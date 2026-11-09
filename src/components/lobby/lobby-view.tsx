import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaLobbyLayout, type LobbySummary } from './arena-lobby-layout';
import { LobbyRecoveryInline } from './lobby-recovery-inline';

export type LobbyData = LobbySummary & {
  activeCasual: { id: string; room_id: string }[];
  activeAi: { room_id: string }[];
  recoveryUnavailable: boolean;
};

/** Presentation boundary for backend integration and credential-free visual verification. */
export function LobbyView({ data, modes, account, friendsEnabled, cosmeticsEnabled, experienceEnabled, omokEnabled = false }: {
  data: LobbyData; modes: ReactNode; account?: ReactNode;
  friendsEnabled?: boolean; cosmeticsEnabled?: boolean; experienceEnabled?: boolean; omokEnabled?: boolean;
}) {
  const hasMatches = data.activeCasual.length > 0 || data.activeAi.length > 0;
  return <ArenaLobbyLayout game="alkkagi" data={data} modes={modes} account={account}
    showGameSwitcher={omokEnabled || process.env.CHESS_UI_ENABLED === 'true'} omokEnabled={omokEnabled} friendsEnabled={friendsEnabled}
    cosmeticsEnabled={cosmeticsEnabled} experienceEnabled={experienceEnabled}
    recovery={<LobbyRecoveryInline hasMatches={hasMatches} unavailable={data.recoveryUnavailable}>
      {data.activeCasual.map((match, index) => <Link key={match.id}
        href={`/rooms/${match.room_id}`} className="arena-button arena-button--outline">
        일반전 {index + 1} 계속하기
      </Link>)}
      {data.activeAi.map((match, index) => <Link key={match.room_id}
        href={`/rooms/${match.room_id}/ai`} className="arena-button arena-button--outline">
        AI 대전 {index + 1} 계속하기
      </Link>)}
    </LobbyRecoveryInline>}
  />;
}
