import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaHero, ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { LogoutForm } from '@/components/auth/logout-form';
import { GameSwitcher } from '@/components/lobby/game-switcher';
import { OmokLobbyModes } from '@/components/omok/omok-lobby-modes';
import { OmokLobbyRanking } from '@/components/omok/omok-lobby-ranking';
import '@/components/omok/omok-lobby-layout.css';

export const dynamic = 'force-dynamic';

/** Omok uses the same hero, three-mode cards, and two-column lobby as Alkkagi. */
export default async function OmokPage() {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  await requireUser();

  return <ArenaShell current="lobby" account={<LogoutForm />}>
    <div className="arena-omok-lobby-page">
      <ArenaHero compact game="omok" />
      <div className="arena-lobby-grid arena-lobby-grid--multigame">
        <div className="arena-play-column">
          <GameSwitcher current="omok" />
          <OmokLobbyModes />
          <ArenaPanel title="오목 아레나 · 15×15" className="arena-omok-overview-panel">
            <p className="arena-muted">검은 돌부터 시작합니다. 가로·세로·대각선으로 다섯 개 이상 연결하면 승리합니다.</p>
            <p className="arena-muted">일반전은 방을 만들거나 코드로 참여하고, AI·랭크전은 위 버튼에서 바로 시작할 수 있습니다.</p>
          </ArenaPanel>
        </div>
        <aside className="arena-sidebar" aria-label="내 정보와 오목 랭킹">
          <ArenaPanel title="내 정보">
            <OmokLobbyRanking />
            <Link href="/profile" className="arena-text-link">내 프로필 <span aria-hidden="true">›</span></Link>
          </ArenaPanel>
          <ArenaPanel title="오목 랭킹">
            <p className="arena-muted">오목 RP는 기존 알까기 RP와 별도로 관리됩니다.</p>
            <Link href="/omok/ranked" className="arena-text-link">랭킹 및 매칭 보기 <span aria-hidden="true">›</span></Link>
          </ArenaPanel>
          <div className="arena-future">
            <Link href="/friends">친구 <small>친구 관리하기 ›</small></Link>
            <Link href="/lobby">알까기 <small>알까기 로비로 ›</small></Link>
          </div>
        </aside>
      </div>
    </div>
  </ArenaShell>;
}
