import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/user';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { MessengerView } from '@/components/messages/messenger-view';
import { isDmPeerId } from '@/components/messages/message-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MessagesPage({
  searchParams,
}: { searchParams: Promise<{ peer?: string | string[] }> }) {
  const user = await requireUser();
  // Keep the UI fail-closed until SQL 004/005/006 and two-user acceptance are complete.
  const enabled = process.env.MESSAGES_UI_ENABLED === 'true' &&
    process.env.FRIENDS_UI_ENABLED === 'true';
  const query = await searchParams;
  const initialPeer = typeof query.peer === 'string' && isDmPeerId(query.peer) &&
    query.peer !== user.id ? query.peer : null;

  return <ArenaShell current="friends">
    <div className="arena-service arena-dm-page">
      <header className="arena-service-heading">
        <div><p className="arena-section-kicker">FRIENDS · DIRECT MESSAGES</p>
          <h1>친구와 주고받는 이야기</h1>
          <p>친구에게 메시지를 보내고 대화를 한곳에서 확인하세요.</p>
        </div>
        <Link href="/friends" className="arena-button arena-button--outline">친구 목록으로</Link>
      </header>
      {enabled ? <MessengerView userId={user.id} initialPeer={initialPeer}/>
        : <ArenaPanel title="메신저 준비 중">
          <p>친구 전용 메시지 기능은 운영 환경 준비 및 안전성 점검 후 이용할 수 있습니다.</p>
          <Link href="/friends" className="arena-text-link">친구 화면으로 돌아가기 ›</Link>
        </ArenaPanel>}
    </div>
  </ArenaShell>;
}
