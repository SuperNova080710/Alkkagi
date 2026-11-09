import Link from 'next/link';
import { ArenaShell } from '@/components/ui/arena';
import { ChessRoomClient } from '@/components/chess/chess-online';
import { requireUser } from '@/lib/auth/user';

export default async function ChessRoomPage({params}: {params: Promise<{id:string}>}) {
  const [user,{id}] = await Promise.all([requireUser(),params]);
  return <ArenaShell game="chess" current="lobby"><div className="arena-waiting arena-waiting--v2">
    <Link href="/chess" className="game-page-back arena-room-back">← 로비로 돌아가기</Link>
    <ChessRoomClient roomId={id} userId={user.id}
      invitesEnabled={process.env.FRIENDS_UI_ENABLED === 'true' && process.env.ROOM_INVITES_UI_ENABLED === 'true'}/>
  </div></ArenaShell>;
}
