import { RankedView } from '@/components/ranked/ranked-view';
import { ChessRankedQueue } from '@/components/chess/chess-ranked';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { getChessRankedDashboard } from '@/lib/chess/ranked';

export default async function ChessRankedPage() {
  const user = await requireUser();
  const db = await createClient();
  const [profile,dashboard] = await Promise.all([
    db.from('profiles').select('nickname').eq('id',user.id).maybeSingle(),
    getChessRankedDashboard(user.id),
  ]);
  return <RankedView nickname={profile.data?.nickname ?? '플레이어'} game="chess" dashboard={dashboard}
    queue={<ChessRankedQueue userId={user.id}/>}/>;
}
