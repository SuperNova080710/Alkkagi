import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { LogoutForm } from '@/components/auth/logout-form';
import { LobbyModes } from '@/components/lobby/lobby-modes';
import { LobbyView, type LobbyData } from '@/components/lobby/lobby-view';

export const dynamic = 'force-dynamic';

export default async function Lobby() {
  const user = await requireUser();
  const db = await createClient();
  const [profile, activeAi, activeCasual, ranking] = await Promise.all([
    db.from('profiles').select('nickname').eq('id', user.id).maybeSingle(),
    db.from('ai_matches').select('room_id,difficulty,created_at').eq('owner_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    db.from('matches').select('id,room_id,created_at').eq('mode', 'casual').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    db.rpc('ranked_dashboard'),
  ]);
  const dashboard = ranking.data as { rating?: number; leaderboard?: LobbyData['leaderboard'] } | null;
  const data: LobbyData = {
    nickname: profile.data?.nickname ?? '닉네임 확인 필요',
    rating: !ranking.error && typeof dashboard?.rating === 'number' ? dashboard.rating : null,
    leaderboard: ranking.error ? [] : dashboard?.leaderboard ?? [],
    rankingUnavailable: Boolean(ranking.error || !dashboard),
    activeAi: activeAi.data ?? [],
    activeCasual: activeCasual.data ?? [],
    recoveryUnavailable: Boolean(activeAi.error || activeCasual.error),
  };
  return <LobbyView data={data} modes={<LobbyModes />} account={<LogoutForm />} />;
}
