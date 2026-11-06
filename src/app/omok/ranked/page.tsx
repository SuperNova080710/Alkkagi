import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokRankedLobby } from '@/components/omok/omok-ranked-client';
import { GameSwitcher } from '@/components/lobby/game-switcher';

export const dynamic = 'force-dynamic';

export default async function OmokRankedPage() {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  const user = await requireUser();
  const db = await createClient();
  const profile = await db.from('profiles').select('nickname').eq('id', user.id).maybeSingle();
  return <ArenaShell current="ranked" game="omok" account={<LogoutForm/>}>
    <div className="arena-service arena-service--ranked">
      <GameSwitcher current="omok" section="ranked"/>
      <OmokRankedLobby nickname={profile.data?.nickname ?? '닉네임 확인 필요'}/>
    </div>
  </ArenaShell>;
}
