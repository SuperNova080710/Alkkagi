import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { PLAYER_UUID } from '@/lib/players/validation';
import { ArenaShell } from '@/components/ui/arena';
import { PublicPlayer } from '@/components/players/public-player';
export const dynamic = 'force-dynamic';
export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!PLAYER_UUID.test(id)) notFound();
  return <ArenaShell current="players"><div className="arena-service arena-directory"><header className="arena-service-heading"><div><p className="arena-section-kicker">PLAYER PROFILE</p><h1>플레이어 프로필</h1><p>이 플레이어가 공개한 정보입니다.</p></div></header><PublicPlayer id={id}/></div></ArenaShell>;
}
