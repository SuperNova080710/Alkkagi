import Link from 'next/link';

export type ArenaGame = 'alkkagi' | 'omok';

/** Navigation between separate game pages (links, not in-page ARIA tabs). */
export function GameSwitcher({ current }: { current: ArenaGame }) {
  return <nav className="arena-game-switcher" aria-label="게임 선택">
    <Link href="/lobby" className={current === 'alkkagi' ? 'is-active' : ''}
      aria-current={current === 'alkkagi' ? 'page' : undefined}>
      <span className="arena-game-switcher-puck" aria-hidden="true">●</span>
      알까기
    </Link>
    <Link href="/omok" className={current === 'omok' ? 'is-active' : ''}
      aria-current={current === 'omok' ? 'page' : undefined}>
      <span className="arena-game-switcher-stones" aria-hidden="true">●<b>●</b></span>
      오목
    </Link>
  </nav>;
}
