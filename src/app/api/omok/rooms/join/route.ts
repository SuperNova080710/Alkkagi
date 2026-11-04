import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { normalizeOmokInvite, omokRpcError } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!await getVerifiedUser()) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }
  const code = body && typeof body === 'object' && !Array.isArray(body) ?
    normalizeOmokInvite((body as Record<string, unknown>).code) : null;
  if (!code) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  try {
    const { data, error } = await (await createClient()).rpc('join_omok_room', { p_code: code });
    if (error) { const failure = omokRpcError(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
    return NextResponse.json({ data: { roomId: data } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 }); }
}
