import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokAiLobby } from '@/components/omok/omok-ai-client';
export const dynamic = 'force-dynamic';
export default async function OmokAiPage() {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  await requireUser();
  return <ArenaShell current="lobby" account={<LogoutForm/>}>
    <div className="arena-omok-overview"><OmokAiLobby/></div>
  </ArenaShell>;
}
