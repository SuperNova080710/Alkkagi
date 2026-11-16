'use client';

import { useRef, type ReactNode } from 'react';
import { ArenaGlassLinks, type ArenaNavItem } from './arena-glass-links';
import { useArenaGlassSurface } from './use-arena-glass-indicator';

export type { ArenaNavItem } from './arena-glass-links';

export function ArenaGlassHeader({ items, activeHref, account, children }: {
  items: ArenaNavItem[];
  activeHref?: string;
  account?: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useArenaGlassSurface(panel);

  return <header className="arena-header">
    <div ref={panel} className="arena-header-glass lg-glass lg-glass--host" aria-hidden="true"/>
    {children}
    <ArenaGlassLinks className="arena-nav" indicatorClass="arena-nav-indicator" label="주요 메뉴"
      scope="main-navigation" items={items} activeHref={activeHref}/>
    {account && <div className="arena-account">{account}</div>}
  </header>;
}
