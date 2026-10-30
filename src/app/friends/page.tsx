import Link from 'next/link';
import { requireUser } from '@/lib/auth/user';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { FriendsView } from '@/components/friends/friends-view';
export const dynamic = 'force-dynamic';
export default async function FriendsPage() {
  await requireUser();
  const enabled = process.env.FRIENDS_UI_ENABLED === 'true';
  return <ArenaShell current="friends"><div className="arena-service arena-directory"><header className="arena-service-heading"><div><p className="arena-section-kicker">PLAY TOGETHER</p><h1>한 판을 함께할 친구</h1><p>친구와 요청을 한곳에서 확인하고 관리하세요.</p></div></header>
    {enabled ? <FriendsView messagesEnabled={process.env.MESSAGES_UI_ENABLED === 'true'} roomInvitesEnabled={process.env.ROOM_INVITES_UI_ENABLED === 'true'}/> : <ArenaPanel title="친구 기능 준비 중"><p>친구 요청과 목록 관리는 준비 중입니다. 지금은 플레이어 검색과 공개 프로필을 이용해 주세요.</p><Link href="/players" className="arena-text-link">플레이어 찾아보기 ›</Link></ArenaPanel>}
  </div></ArenaShell>;
}
