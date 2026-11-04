import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokMatchClient } from '@/components/omok/omok-match-client';
export const dynamic = 'force-dynamic';
export default async function OmokRankedMatchPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  return <ArenaShell current="ranked" game="omok" account={<LogoutForm/>}>
    <div className="arena-omok-overview arena-omok-live-stack">
      <Link href="/omok/ranked" className="arena-button arena-button--outline">← 오목 랭크 로비</Link>
      <OmokMatchClient matchId={id} currentUserId={user.id} kind="ranked"/>
    </div>
  </ArenaShell>;
}
