import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokLobbyView, type OmokLobbyData } from '@/components/omok/omok-lobby-view';
import '@/components/omok/omok-parity.css';

export const dynamic = 'force-dynamic';

/** Omok UI stays behind the same server-side feature gate; never enables DB features. */
export default async function OmokPage() {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  const user = await requireUser();
  const db = await createClient();
  const [profile, casual, ai, ranking] = await Promise.all([
    db.from('profiles').select('nickname').eq('id', user.id).maybeSingle(),
    db.from('omok_matches').select('id,room_id,mode').eq('status', 'active')
      .or(`black_id.eq.${user.id},white_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(5),
    db.from('omok_ai_matches').select('id').eq('owner_id', user.id)
      .eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    db.rpc('omok_ranked_dashboard'),
  ]);
  const raw = ranking.data as { rating?: unknown; leaderboard?: unknown } | null;
  const leaderboard = Array.isArray(raw?.leaderboard) ? raw.leaderboard.filter((entry): entry is {
    position: number; nickname: string; rating: number;
  } => !!entry && typeof entry === 'object' && typeof entry.position === 'number' &&
    typeof entry.nickname === 'string' && typeof entry.rating === 'number') : [];
  const data: OmokLobbyData = {
    nickname: profile.data?.nickname ?? '닉네임 확인 필요',
    rating: !ranking.error && typeof raw?.rating === 'number' ? raw.rating : null,
    leaderboard,
    rankingUnavailable: !!ranking.error || !raw,
    activeCasual: casual.data ?? [],
    activeAi: ai.data ?? [],
    recoveryUnavailable: !!casual.error || !!ai.error,
  };
  return <OmokLobbyView data={data} account={<LogoutForm />}
    friendsEnabled={process.env.FRIENDS_UI_ENABLED === 'true'}
    cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}
    experienceEnabled={process.env.EXPERIENCE_UI_ENABLED === 'true'}/>;
}
