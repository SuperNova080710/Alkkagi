import { ArenaShell } from '@/components/ui/arena';
import { ChessMatchClient } from '@/components/chess/chess-online';
import { requireUser } from '@/lib/auth/user';

export default async function ChessMatchPage({params}: {params: Promise<{id:string}>}) {
  const [user,{id}] = await Promise.all([requireUser(),params]);
  return <ArenaShell game="chess"><div className="chess-page">
    <ChessMatchClient key={id} matchId={id} userId={user.id}/>
  </div></ArenaShell>;
}
