import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ArenaGame } from '@/components/lobby/game-switcher';

export function ArenaShell({ children, current, account, game = 'alkkagi' }: {
  children: ReactNode;
  current?: 'lobby' | 'ranked' | 'profile' | 'players' | 'friends' | 'messages' | 'cosmetics';
  account?: ReactNode;
  game?: ArenaGame;
}) {
  const omokEnabled = process.env.OMOK_UI_ENABLED === 'true';
  const currentGame = game === 'chess' && process.env.CHESS_UI_ENABLED === 'true' ? 'chess'
    : game === 'omok' && omokEnabled ? 'omok' : 'alkkagi';
  const lobbyHref = currentGame === 'chess' ? '/chess' : currentGame === 'omok' ? '/omok' : '/lobby';
  const rankedHref = currentGame === 'chess' ? '/chess/ranked' : currentGame === 'omok' ? '/omok/ranked' : '/ranked';
  return <div className="arena">
    <a className="arena-skip" href="#arena-content">본문으로 이동</a>
    <div className="arena-wrap">
      <header className="arena-header">
        <Link href="/" className="arena-brand" aria-label="ALKKAGI ARENA 홈">
          <span>ALKKAGI</span><span>ARENA</span>
        </Link>
        <nav aria-label="주요 메뉴" className="arena-nav">
          <Link href={lobbyHref} aria-current={current === 'lobby' ? 'page' : undefined}>로비</Link>
          <Link href={rankedHref} aria-current={current === 'ranked' ? 'page' : undefined}>랭킹</Link>
          <Link href="/players" aria-current={current === 'players' ? 'page' : undefined}>플레이어</Link>
          <Link href="/friends" aria-current={current === 'friends' ? 'page' : undefined}>친구</Link>
          {process.env.FRIENDS_UI_ENABLED === 'true' && process.env.MESSAGES_UI_ENABLED === 'true' &&
            <Link href="/messages" aria-current={current === 'messages' ? 'page' : undefined}>메신저</Link>}
          <Link href="/profile" aria-current={current === 'profile' ? 'page' : undefined}>내 프로필</Link>
          {process.env.COSMETICS_UI_ENABLED === 'true' && <Link href="/cosmetics" aria-current={current === 'cosmetics' ? 'page' : undefined}>꾸미기</Link>}
        </nav>
        {account && <div className="arena-account">{account}</div>}
      </header>
      <main id="arena-content" tabIndex={-1}>{children}</main>
      <footer className="arena-footer">ALKKAGI ARENA <span>작은 알 하나, 큰 승부 한 판.</span></footer>
    </div>
  </div>;
}

export function ArenaHero({ children, compact = false, game = 'alkkagi' }: {
  children?: ReactNode; compact?: boolean; game?: ArenaGame;
}) {
  const omok = game === 'omok';
  const chess = game === 'chess';
  return <section className={`arena-hero${compact ? ' arena-hero--compact' : ''}${omok ? ' arena-hero--omok' : chess ? ' arena-chess-hero' : ''}`}
    aria-label={chess ? '체스 아레나' : omok ? '오목 아레나' : '알까기 아레나'}>
    {chess ? <span className="arena-chess-hero-piece" aria-hidden="true">♞</span> : omok
      ? <div className="arena-omok-hero-art" aria-hidden="true"><span/><span/><span/><span/><span/></div>
      : <Image src="/art/hero.webp" alt="" fill sizes="(max-width: 1440px) 100vw, 1440px" preload className="arena-hero-art" />}
    <div className="arena-hero-copy">
      <p className="arena-eyebrow">{chess ? '64개의 칸 위에서 펼치는 승부' : omok ? '흑과 백이 만나는 전략의 승부' : '손끝에서 시작되는 작은 승부'}</p>
      <h1><span>{chess ? 'CHESS' : omok ? 'OMOK' : 'ALKKAGI'}</span><span>ARENA</span></h1>
      <p className="arena-hero-tagline">{chess ? '한 수씩, 체크메이트를 향해!' : omok ? '돌 하나로 뒤집는 다섯 수의 승부!' : '작은 알 하나, 큰 승부 한 판!'}</p>
      {children}
    </div>
  </section>;
}

export type ArenaMode = 'casual' | 'ranked' | 'ai';
const modeContent = {
  casual: { title: '일반전', description: '친구와 함께, 언제든지 자유롭게 대결해요!' },
  ranked: { title: '랭크전', description: '실력을 겨루고 RP 순위에 도전하세요!' },
  ai: { title: 'AI 대전', description: '다양한 난이도의 AI와 연습해요!' },
};
export function ArenaModeCard({ mode, children, game = 'alkkagi' }: {
  mode: ArenaMode; children: ReactNode; game?: ArenaGame;
}) {
  const omok = game === 'omok';
  const content = omok ? {
    casual: { title: '일반전', description: '친구와 함께, 오목 한 판을 즐겨요!' },
    ranked: { title: '랭크전', description: '오목 전용 RP와 순위에 도전하세요!' },
    ai: { title: 'AI 대전', description: '세 가지 난이도로 오목을 연습해요!' },
  }[mode] : modeContent[mode];
  return <article className={`arena-mode arena-mode--${mode}${omok ? ' arena-mode--omok' : ''}`}>
    <div className="arena-mode-art">
      {game === 'chess' ? <span className="chess-mode-piece" aria-hidden="true">
          {mode === 'casual' ? '♜' : mode === 'ranked' ? '♛' : '♞'}
        </span> : omok ? <div className="arena-mode-omok-art" aria-hidden="true"><span/><span/><span/><span/><span/></div>
        : <Image src={`/art/${mode}.webp`} alt="" fill sizes="(max-width: 639px) 112px, (max-width: 1023px) 33vw, 320px" />}
    </div>
    <div className="arena-mode-heading"><h2>{content.title}</h2><p>{content.description}</p></div>
    <div className="arena-mode-actions">{children}</div>
  </article>;
}

export { ArenaPanel } from './arena-panel';
