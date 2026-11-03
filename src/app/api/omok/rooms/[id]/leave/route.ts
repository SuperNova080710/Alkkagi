import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokUuid, omokRpcError } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getVerifiedUser()) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { id } = await params;
  if (!isOmokUuid(id)) return NextResponse.json({ error: 'INVALID_ROOM' }, { status: 400 });
  try {
    const { error } = await (await createClient()).rpc('leave_omok_room', { p_room_id: id });
    if (error) { const failure = omokRpcError(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 }); }
}
