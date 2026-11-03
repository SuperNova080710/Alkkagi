import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { ArenaShell } from '@/components/ui/arena';
import { GameSwitcher } from '@/components/lobby/game-switcher';

export const dynamic = 'force-dynamic';

const modes = [
  { key: 'casual', number: '01', title: '일반전', description: '친구와 방을 만들고 오목 한 판을 즐겨요.', action: '방 만들기 · 코드 참가', color: 'gold' },
  { key: 'ranked', number: '02', title: '랭크전', description: '오목만의 독립된 RP와 순위에 도전해요.', action: '랭크 매칭', color: 'green' },
  { key: 'ai', number: '03', title: 'AI 대전', description: '쉬움·보통·어려움 난이도로 연습해요.', action: 'AI 연습', color: 'blue' },
] as const;

/** UI staging page: never exposes unmerged PvP/AI/ranked APIs as playable. */
export default async function OmokPage() {
  if (process.env.OMOK_UI_ENABLED !== 'true') notFound();
  await requireUser();
  return <ArenaShell current="lobby">
    <div className="arena-omok-overview">
      <GameSwitcher current="omok" />
      <header className="arena-omok-hero">
        <div>
          <p className="arena-section-kicker">OMOK ARENA · 15×15</p>
          <h1>오목 아레나</h1>
          <p>검은 돌이 먼저 시작합니다. 가로·세로·대각선으로 다섯 개 이상 연결하면 승리합니다.</p>
          <span className="arena-omok-notice">오목 대전 서버 연결 준비 중 · 기존 알까기에는 영향이 없습니다.</span>
        </div>
        <div className="arena-omok-emblem" aria-hidden="true">
          <span/><span/><span/><span/><span/>
        </div>
      </header>
      <section className="arena-omok-mode-grid" aria-label="오목 대전 방식">
        {modes.map(mode => <article key={mode.key}
          className={`arena-omok-mode-card arena-omok-mode-card--${mode.color}`}>
          <span className="arena-omok-mode-number" aria-hidden="true">{mode.number}</span>
          <h2>{mode.title}</h2>
          <p>{mode.description}</p>
          <button type="button" className="arena-button" disabled
            aria-label={mode.title + ' 준비 중'}>{mode.action} · 준비 중</button>
        </article>)}
      </section>
      <p className="arena-omok-status" role="status">서버 API·운영 DB·릴리스 검증이 완료되면 오목 대전 기능이 활성화됩니다.</p>
    </div>
  </ArenaShell>;
}
