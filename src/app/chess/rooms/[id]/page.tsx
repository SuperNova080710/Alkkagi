import { ArenaShell } from '@/components/ui/arena';
import { ChessRoomClient } from '@/components/chess/chess-online';
import { requireUser } from '@/lib/auth/user';

export default async function ChessRoomPage({params}: {params: Promise<{id:string}>}) {
  const [user,{id}] = await Promise.all([requireUser(),params]);
  return <ArenaShell game="chess" current="lobby"><div className="chess-page">
    <ChessRoomClient roomId={id} userId={user.id}/>
  </div></ArenaShell>;
}
