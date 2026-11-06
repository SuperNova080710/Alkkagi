import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { isOmokUuid, parseOmokMessage, omokRpcError } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Params) {
  if (!await getVerifiedUser()) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { id } = await params;
  if (!isOmokUuid(id)) return NextResponse.json({ error: 'INVALID_MATCH' }, { status: 400 });
  try {
    const db = await createClient();
    // The match gate avoids returning an empty list to non-participants and
    // leaking the existence of another player's match via the chat endpoint.
    const { data: match, error: matchError } = await db.from('omok_matches')
      .select('id,mode').eq('id', id).maybeSingle();
    if (matchError) return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 });
    if (!match) return NextResponse.json({ error: 'MATCH_NOT_FOUND' }, { status: 404 });
    if (match.mode === 'ranked') return NextResponse.json({ error: 'CHAT_NOT_AVAILABLE' }, { status: 403 });
    const { data, error } = await db.from('omok_match_messages')
      .select('id,sender_id,body,created_at')
      .eq('match_id', id).order('created_at', { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 });
    return NextResponse.json({ data: (data ?? []).reverse() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 }); }
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!await getVerifiedUser()) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { id } = await params;
  if (!isOmokUuid(id)) return NextResponse.json({ error: 'INVALID_MATCH' }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }
  const message = parseOmokMessage(payload);
  if (!message) return NextResponse.json({ error: 'INVALID_MESSAGE' }, { status: 400 });
  try {
    const db = await createClient();
    // The same participant RLS gate as GET, before invoking a privileged RPC.
    const { data: match, error: matchError } = await db.from('omok_matches')
      .select('id,mode').eq('id', id).maybeSingle();
    if (matchError) return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 });
    if (!match) return NextResponse.json({ error: 'MATCH_NOT_FOUND' }, { status: 404 });
    if (match.mode === 'ranked') return NextResponse.json({ error: 'CHAT_NOT_AVAILABLE' }, { status: 403 });
    const { data, error } = await db.rpc('send_omok_match_message',
      { p_match_id: id, p_body: message.body, p_request_id: message.requestId });
    if (error) { const failure = omokRpcError(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 }); }
}
