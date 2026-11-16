import { ArenaGlassLinks, type ArenaNavItem } from '@/components/ui/arena-glass-links';

export type ArenaGame = 'alkkagi' | 'omok' | 'chess';

/** Native page navigation; ranked switchers stay on ranking pages. */
export function GameSwitcher({ current, section = 'lobby', omokEnabled = true }: {
  current: ArenaGame;
  section?: 'lobby' | 'ranked';
  omokEnabled?: boolean;
}) {
  const ranked = section === 'ranked';
  const items: ArenaNavItem[] = [{
    key: 'alkkagi', href: ranked ? '/ranked' : '/lobby',
    label: <><span className="arena-game-switcher-puck" aria-hidden="true">●</span> 알까기</>,
  }];
  if (omokEnabled) items.push({
    key: 'omok', href: ranked ? '/omok/ranked' : '/omok',
    label: <><span className="arena-game-switcher-stones" aria-hidden="true">●<b>●</b></span> 오목</>,
  });
  if (process.env.CHESS_UI_ENABLED === 'true') items.push({
    key: 'chess', href: ranked ? '/chess/ranked' : '/chess',
    label: <><span aria-hidden="true">♞</span> 체스</>,
  });
  return <ArenaGlassLinks className="arena-game-switcher" label={ranked ? '랭킹 게임 선택' : '게임 선택'}
    scope={'game-switcher-' + section} activeClass="is-active"
    items={items} activeHref={items.find(item => item.key === current)?.href}/>;
}
