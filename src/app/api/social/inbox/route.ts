import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { SocialGame } from '@/lib/social/inbox';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

async function list(query: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
  try {
    const { data, error } = await query();
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function GET() {
  if (process.env.FRIENDS_UI_ENABLED !== 'true')
    return NextResponse.json({ error: 'SOCIAL_UNAVAILABLE' }, { status: 404, headers: noStore });
  const user = await getVerifiedUser();
  if (!user)
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: noStore });

  const db = await createClient().catch(() => null);
  if (!db)
    return NextResponse.json({ error: 'SOCIAL_UNAVAILABLE' }, { status: 503, headers: noStore });
  const inviteLists: Array<Promise<readonly [SocialGame, unknown]>> = [];
  if (process.env.ROOM_INVITES_UI_ENABLED === 'true') {
    inviteLists.push(list(() => db.rpc('list_received_room_invites')).then(data => ['alkkagi', data] as const));
    if (process.env.OMOK_UI_ENABLED === 'true')
      inviteLists.push(list(() => db.rpc('list_omok_received_invites')).then(data => ['omok', data] as const));
    if (process.env.CHESS_UI_ENABLED === 'true')
      inviteLists.push(list(() => createAdminClient().rpc('chess_list_received_invites', { actor: user.id }))
        .then(data => ['chess', data] as const));
  }

  const [overview, messages, invites] = await Promise.all([
    list(() => db.rpc('get_friend_overview')),
    process.env.MESSAGES_UI_ENABLED === 'true' ? list(() => db.rpc('get_direct_message_inbox')) : undefined,
    Promise.all(inviteLists),
  ]);
  const requests = overview && typeof overview === 'object' && 'incoming' in overview
    ? overview.incoming : null;
  return NextResponse.json({ data: { userId: user.id, requests, messages, invites: Object.fromEntries(invites) } },
    { headers: noStore });
}
