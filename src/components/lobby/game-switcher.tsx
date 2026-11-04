import Link from 'next/link';

export type ArenaGame = 'alkkagi' | 'omok';

/** Native page navigation; ranked switchers stay on ranking pages. */
export function GameSwitcher({ current, section = 'lobby' }: {
  current: ArenaGame;
  section?: 'lobby' | 'ranked';
}) {
  const alkkagiHref = section === 'ranked' ? '/ranked' : '/lobby';
  const omokHref = section === 'ranked' ? '/omok/ranked' : '/omok';
  return <nav className="arena-game-switcher"
    aria-label={section === 'ranked' ? '랭킹 게임 선택' : '게임 선택'}>
    <Link href={alkkagiHref} className={current === 'alkkagi' ? 'is-active' : ''}
      aria-current={current === 'alkkagi' ? 'page' : undefined}>
      <span className="arena-game-switcher-puck" aria-hidden="true">●</span>
      알까기
    </Link>
    <Link href={omokHref} className={current === 'omok' ? 'is-active' : ''}
      aria-current={current === 'omok' ? 'page' : undefined}>
      <span className="arena-game-switcher-stones" aria-hidden="true">●<b>●</b></span>
      오목
    </Link>
  </nav>;
}
