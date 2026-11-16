'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { prepareArenaPageSlide } from './arena-page';
import { useArenaGlassIndicator } from './use-arena-glass-indicator';

export type ArenaNavItem = { key: string; href: string; label: ReactNode };

export function ArenaGlassLinks({ items, activeHref, scope, className, label, activeClass, indicatorClass }: {
  items: ArenaNavItem[];
  activeHref?: string;
  scope: string;
  className: string;
  label: string;
  activeClass?: string;
  indicatorClass?: string;
}) {
  const { track, indicator, selectLink } = useArenaGlassIndicator<HTMLElement>(activeHref, scope);
  const activeIndex = items.findIndex(item => item.href === activeHref);
  return <nav ref={track} className={className} aria-label={label}>
    <span ref={indicator} className={'arena-glass-indicator lg-glass' + (indicatorClass ? ' ' + indicatorClass : '')}
      aria-hidden="true"/>
    {items.map((item, index) => <Link key={item.key} href={item.href} data-glass-option={item.href}
      className={activeClass ? item.href === activeHref ? activeClass : '' : undefined}
      aria-current={item.href === activeHref ? (item.href.startsWith('#') ? 'location' : 'page') : undefined}
      onNavigate={() => {
        prepareArenaPageSlide(item.href, index < activeIndex ? 'back' : 'forward');
        selectLink(item.href);
      }}>{item.label}</Link>)}
  </nav>;
}
