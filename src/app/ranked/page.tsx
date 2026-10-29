import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { RankedQueue } from '@/components/ranked/ranked-queue';
import { RankedView, type RankedDashboard } from '@/components/ranked/ranked-view';
import { type QueueStatus } from '@/app/ranked/actions';
export const dynamic = 'force-dynamic';
export default async function RankedPage() {
  const user = await requireUser();
  const db = await createClient();
  const [statusQuery, boardQuery, profileQuery] = await Promise.all([
    db.rpc('ranked_queue_status'), db.rpc('ranked_dashboard'),
    db.from('profiles').select('nickname').eq('id', user.id).maybeSingle(),
  ]);
  const raw = statusQuery.data as { status?: string; matchId?: unknown } | null;
  const status: QueueStatus = {
    status: raw?.status === 'queued' || raw?.status === 'matched' ? raw.status : 'idle',
    matchId: typeof raw?.matchId === 'string' ? raw.matchId : null,
    ...(statusQuery.error ? { error: '매칭 상태를 불러오지 못했습니다. 새로고침해 주세요.' } : {}),
  };
  const dashboard = !boardQuery.error && boardQuery.data ? boardQuery.data as RankedDashboard : null;
  return <RankedView nickname={profileQuery.data?.nickname ?? '닉네임 확인 필요'} dashboard={dashboard} queue={<RankedQueue initial={status}/>} />;
}
