import Link from 'next/link';
import { ArenaLobbyLayout } from '@/components/lobby/arena-lobby-layout';
import { ChessLobbyModes } from '@/components/chess/chess-lobby-modes';
import { LobbyRecoveryInline } from '@/components/lobby/lobby-recovery-inline';
import { LogoutForm } from '@/components/auth/logout-form';
import { requireUser } from '@/lib/auth/user';
import { getChessRankedDashboard } from '@/lib/chess/ranked';
import { createClient } from '@/lib/supabase/server';

export default async function ChessLobbyPage() {
  const user = await requireUser();
  const db = await createClient();
  const [profile, games, dashboard] = await Promise.all([
    db.from('profiles').select('nickname').eq('id',user.id).maybeSingle(),
    db.from('chess_matches').select('id').is('finished_at',null).order('created_at',{ascending:false}).limit(5),
    getChessRankedDashboard(user.id),
  ]);
  return <ArenaLobbyLayout game="chess" account={<LogoutForm/>} showGameSwitcher
    omokEnabled={process.env.OMOK_UI_ENABLED === 'true'}
    friendsEnabled={process.env.FRIENDS_UI_ENABLED === 'true'}
    experienceEnabled={process.env.EXPERIENCE_UI_ENABLED === 'true'}
    cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}
    data={{nickname:profile.data?.nickname ?? '플레이어',rating:dashboard?.rating ?? null,leaderboard:dashboard?.leaderboard ?? [],rankingUnavailable:!dashboard}}
    recovery={<LobbyRecoveryInline hasMatches={Boolean(games.data?.length)} unavailable={Boolean(games.error)}>
      {games.data?.map((game, i) => <Link key={game.id} href={'/chess/matches/' + game.id}
        className="arena-button arena-button--outline">체스 대국 {i + 1} 계속하기</Link>)}
    </LobbyRecoveryInline>}
    modes={<ChessLobbyModes invitesEnabled={process.env.FRIENDS_UI_ENABLED === 'true' &&
      process.env.ROOM_INVITES_UI_ENABLED === 'true'}/>}/>;
}
