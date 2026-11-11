import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokAiMatchClient } from '@/components/omok/omok-ai-client';
export const dynamic = 'force-dynamic';
export default async function OmokAiMatchPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  return <ArenaShell current="lobby" game="omok" account={<LogoutForm/>}>
    <div className="arena-omok-overview"><OmokAiMatchClient matchId={id} currentUserId={user.id}/></div>
  </ArenaShell>;
}
