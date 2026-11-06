import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RankedDashboard } from '@/components/ranked/ranked-view';
import { chessDbError } from './http';

export async function getChessRankedDashboard(userId: string): Promise<RankedDashboard | null> {
  try {
    const {data,error} = await createAdminClient().rpc('chess_ranked_dashboard', {p_actor:userId});
    return error ? null : data as RankedDashboard;
  } catch { return null; }
}

export async function chessRankedQueue(userId: string, action: 'status' | 'join' | 'cancel') {
  const {data,error} = await createAdminClient().rpc('chess_ranked_queue', {p_actor:userId,p_action:action});
  if (error) chessDbError(error);
  return data;
}
