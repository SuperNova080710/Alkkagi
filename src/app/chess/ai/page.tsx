import { ArenaShell } from '@/components/ui/arena';
import { ChessAi } from '@/components/chess/chess-ai';
import { requireUser } from '@/lib/auth/user';

export default async function ChessAiPage() {
  const user = await requireUser();
  return <ArenaShell game="chess"><div className="chess-page"><ChessAi userId={user.id}/></div></ArenaShell>;
}
