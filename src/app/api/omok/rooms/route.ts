import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { createOmokInviteCode, omokRpcError } from '@/lib/omok/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!await getVerifiedUser()) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  try {
    const db = await createClient();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db.rpc('create_omok_room', { p_code: createOmokInviteCode() });
      if (!error && typeof data === 'string')
        return NextResponse.json({ data: { roomId: data } }, { headers: { 'Cache-Control': 'no-store' } });
      if (error?.code !== '23505')
        return NextResponse.json(omokRpcError(error), { status: omokRpcError(error).status });
    }
    return NextResponse.json({ error: 'ROOM_CODE_CONFLICT' }, { status: 409 });
  } catch {
    return NextResponse.json({ error: 'GAME_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}
