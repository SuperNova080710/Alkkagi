import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokUuid, parseOmokMove, omokRpcError } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getVerifiedUser()) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { id } = await params;
  if (!isOmokUuid(id)) return NextResponse.json({ error: 'INVALID_MATCH' }, { status: 400 });
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }
  const move = parseOmokMove(input);
  if (!move) return NextResponse.json({ error: 'INVALID_MOVE' }, { status: 400 });
  try {
    const { data, error } = await (await createClient()).rpc('play_omok_move', {
      p_match_id: id, p_request_id: move.requestId, p_turn: move.turnNo,
      p_row: move.row, p_col: move.col,
    });
    if (error) { const failure = omokRpcError(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 }); }
}
