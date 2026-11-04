import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { OmokCasualRoomClient } from '@/components/omok/omok-casual-room-client';

export const dynamic = 'force-dynamic';

/** Follow the Alkkagi casual waiting page's full-bleed layout, not the lobby shell. */
export default async function OmokRoomPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();

  return <div className="arena">
    <main className="arena-waiting arena-waiting--v2 mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <Link href="/omok" className="game-page-back arena-room-back">← 로비로 돌아가기</Link>
      <OmokCasualRoomClient roomId={id} currentUserId={user.id}
        invitesEnabled={process.env.FRIENDS_UI_ENABLED === 'true' &&
          process.env.ROOM_INVITES_UI_ENABLED === 'true'}/>
    </main>
  </div>;
}
