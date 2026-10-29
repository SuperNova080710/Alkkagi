import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { PlayerSearch } from '@/components/players/player-search';
export const dynamic = 'force-dynamic';
export default async function PlayersPage() {
  await requireUser();
  return <ArenaShell current="players"><div className="arena-service arena-directory"><header className="arena-service-heading"><div><p className="arena-section-kicker">FIND YOUR RIVAL</p><h1>다음 한 판의 주인공</h1><p>닉네임으로 플레이어를 찾고, 공개된 프로필을 살펴보세요.</p></div></header><PlayerSearch/></div></ArenaShell>;
}
