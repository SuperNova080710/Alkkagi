import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokRankedLobby } from '@/components/omok/omok-ranked-client';
import { GameSwitcher } from '@/components/lobby/game-switcher';
export const dynamic = 'force-dynamic';
export default async function OmokRankedPage() {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  await requireUser();
  return <ArenaShell current="ranked" game="omok" account={<LogoutForm/>}>
    <div className="arena-omok-overview"><GameSwitcher current="omok" section="ranked"/><OmokRankedLobby/></div>
  </ArenaShell>;
}
