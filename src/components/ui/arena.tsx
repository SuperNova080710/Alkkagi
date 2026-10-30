import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function ArenaShell({ children, current, account }: {
  children: ReactNode;
  current?: 'lobby' | 'ranked' | 'profile' | 'players' | 'friends' | 'cosmetics';
  account?: ReactNode;
}) {
  return <div className="arena">
    <a className="arena-skip" href="#arena-content">본문으로 이동</a>
    <div className="arena-wrap">
      <header className="arena-header">
        <Link href="/" className="arena-brand" aria-label="ALKKAGI ARENA 홈">
          <span>ALKKAGI</span><span>ARENA</span>
        </Link>
        <nav aria-label="주요 메뉴" className="arena-nav">
          <Link href="/lobby" aria-current={current === 'lobby' ? 'page' : undefined}>로비</Link>
          <Link href="/ranked" aria-current={current === 'ranked' ? 'page' : undefined}>랭킹</Link>
          <Link href="/players" aria-current={current === 'players' ? 'page' : undefined}>플레이어</Link>
          <Link href="/friends" aria-current={current === 'friends' ? 'page' : undefined}>친구</Link>
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

export function ArenaHero({ children, compact = false }: { children?: ReactNode; compact?: boolean }) {
  return <section className={`arena-hero${compact ? ' arena-hero--compact' : ''}`} aria-label="알까기 아레나">
    <Image src="/art/hero.webp" alt="" fill sizes="(max-width: 1440px) 100vw, 1440px" preload className="arena-hero-art" />
    <div className="arena-hero-copy">
      <p className="arena-eyebrow">손끝에서 시작되는 작은 승부</p>
      <h1><span>ALKKAGI</span><span>ARENA</span></h1>
      <p className="arena-hero-tagline">작은 알 하나, 큰 승부 한 판!</p>
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
export function ArenaModeCard({ mode, children }: { mode: ArenaMode; children: ReactNode }) {
  const content = modeContent[mode];
  return <article className={`arena-mode arena-mode--${mode}`}>
    <div className="arena-mode-art">
      <Image src={`/art/${mode}.webp`} alt="" fill sizes="(max-width: 639px) 112px, (max-width: 1023px) 33vw, 320px" />
    </div>
    <div className="arena-mode-heading"><h2>{content.title}</h2><p>{content.description}</p></div>
    <div className="arena-mode-actions">{children}</div>
  </article>;
}

export function ArenaPanel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`arena-panel ${className}`}><h2>{title}</h2>{children}</section>;
}
