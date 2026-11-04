import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { OmokCasualRoomClient } from '@/components/omok/omok-casual-room-client';
export const dynamic = 'force-dynamic';
export default async function OmokRoomPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  return <ArenaShell current="lobby" account={<LogoutForm/>}>
    <div className="arena-omok-overview arena-omok-live-stack">
      <Link href="/omok" className="arena-button arena-button--outline">← 오목 로비</Link>
      <OmokCasualRoomClient roomId={id} currentUserId={user.id}
        invitesEnabled={process.env.FRIENDS_UI_ENABLED === 'true' &&
          process.env.ROOM_INVITES_UI_ENABLED === 'true'}/>
    </div>
  </ArenaShell>;
}
