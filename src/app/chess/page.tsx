import Link from 'next/link';
import { ArenaLobbyLayout } from '@/components/lobby/arena-lobby-layout';
import { ArenaModeCard } from '@/components/ui/arena';
import { ChessRoomEntry } from '@/components/chess/chess-online';
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
    recovery={games.data?.length ? <div className="chess-actions" aria-label="진행 중인 체스 경기">
      {games.data.map((game, i) => <Link key={game.id} href={'/chess/matches/' + game.id}
        className="arena-button arena-button--outline">진행 중인 경기 {i+1}</Link>)}
    </div> : null}
    modes={<div className="arena-modes">
      <ArenaModeCard game="chess" mode="casual"><ChessRoomEntry/></ArenaModeCard>
      <ArenaModeCard game="chess" mode="ranked"><Link href="/chess/ranked" className="arena-button arena-button--gold">랭크전</Link></ArenaModeCard>
      <ArenaModeCard game="chess" mode="ai"><Link href="/chess/ai" className="arena-button">난이도 선택</Link></ArenaModeCard>
    </div>}/>;
}
