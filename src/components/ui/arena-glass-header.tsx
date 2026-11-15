'use client';

import { createSpring, springFrom, useRefraction, type Spring } from '@zakisheriff/liquid-glass';
import Link from 'next/link';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

export type ArenaNavItem = { key: string; href: string; label: string };
type Bounds = { x: number; y: number; width: number; height: number };
type SelectionTransfer = { owner: symbol; href: string; bounds: Bounds; until: number };

// Next replaces the header on some page transitions. Carry the live pill position
// through a client-side link navigation so the new header can finish the slide.
let selectionTransfer: SelectionTransfer | undefined;

const indicatorSpring = springFrom(0.42, 0.59);
const panelShape = { kind: 'surface', bezel: 18, thickness: 24, strength: 1.4 } as const;
const indicatorShape = { kind: 'lens', bezel: 10, thickness: 13, strength: 0.9, zoom: 1.04 } as const;
const mix = (start: number, end: number, progress: number) => start + (end - start) * progress;

function equalBounds(a: Bounds | undefined, b: Bounds) {
  return a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

export function ArenaGlassHeader({ items, activeHref, account, children }: {
  items: ArenaNavItem[];
  activeHref?: string;
  account?: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const navigate = useRef<(href: string) => void>(null);

  useRefraction(panel, panelShape, typeof ResizeObserver === 'function');
  useRefraction(indicator, indicatorShape, typeof ResizeObserver === 'function');

  useLayoutEffect(() => {
    const menu = nav.current;
    const lens = indicator.current;
    if (!menu || !lens || typeof ResizeObserver !== 'function') return;
    const owner = Symbol();
    const menuElement = menu;
    const indicatorElement = lens;

    const links = [...menu.querySelectorAll<HTMLAnchorElement>('a[href]')];
    let selected = links.find(link => link.getAttribute('href') === activeHref);
    let painted: Bounds | undefined;
    let target: Bounds | undefined;
    let spring: Spring | undefined;
    let menuWidth = menu.clientWidth;
    let menuHeight = menu.clientHeight;

    function measure(link: HTMLAnchorElement): Bounds {
      const reference = menuElement.getBoundingClientRect();
      const rect = link.getBoundingClientRect();
      const height = Math.min(48, Math.max(1, rect.height - 4));
      return {
        x: rect.left - reference.left + 1,
        y: rect.top - reference.top + (rect.height - height) / 2,
        width: Math.max(1, rect.width - 2), height,
      };
    }

    function draw(box: Bounds) {
      const { width, height } = box;
      const x = Math.max(0, Math.min(box.x, menuWidth - width));
      const y = Math.max(0, Math.min(box.y, menuHeight - height));
      painted = { x, y, width, height };
      indicatorElement.style.width = width + 'px';
      indicatorElement.style.height = height + 'px';
      indicatorElement.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      menuElement.dataset.indicatorReady = '';
      if (selectionTransfer?.owner === owner) selectionTransfer.bounds = painted;
    }

    function select(link: HTMLAnchorElement, animate: boolean, start = painted) {
      if (selected !== link) selected?.removeAttribute('data-glass-selected');
      selected = link;
      link.dataset.glassSelected = '';
      const end = measure(link);
      target = end;
      spring?.stop();
      if (!start || !animate) {
        draw(end);
        return;
      }

      // Spring overshoot moves the pill past the destination. Velocity also
      // stretches it along the slide and compresses it vertically.
      spring = createSpring(0, indicatorSpring, (progress, velocity) => {
        const stretch = Math.max(-0.045, Math.min(0.095, velocity * 0.009));
        const width = mix(start.width, end.width, progress);
        const height = mix(start.height, end.height, progress);
        draw({
          x: mix(start.x, end.x, progress) - width * stretch / 2,
          y: mix(start.y, end.y, progress) + height * stretch / 3,
          width: Math.max(1, Math.min(menuWidth, width * (1 + stretch))),
          height: Math.max(1, height * (1 - stretch * 0.67)),
        });
      });
      draw(start);
      spring.set(1);
    }

    if (selected) {
      const transfer = selectionTransfer;
      const incoming = transfer && transfer.href === activeHref && transfer.until > performance.now() ? transfer.bounds : undefined;
      if (incoming) selectionTransfer = undefined;
      select(selected, Boolean(incoming), incoming);
    }

    navigate.current = href => {
      const link = links.find(item => item.getAttribute('href') === href);
      if (!link) return;
      if (href !== activeHref && !href.startsWith('#') && painted)
        selectionTransfer = { owner, href, bounds: painted, until: performance.now() + 2500 };
      select(link, true);
    };

    const resize = new ResizeObserver(() => {
      menuWidth = menu.clientWidth;
      menuHeight = menu.clientHeight;
      if (selected && !equalBounds(target, measure(selected))) select(selected, false);
    });
    resize.observe(menu);
    links.forEach(link => resize.observe(link));

    return () => {
      navigate.current = null;
      spring?.stop();
      resize.disconnect();
      selected?.removeAttribute('data-glass-selected');
      delete menu.dataset.indicatorReady;
    };
  }, [activeHref, items]);

  return <header className="arena-header">
    <div ref={panel} className="arena-header-glass lg-glass lg-glass--host" aria-hidden="true"/>
    {children}
    <nav ref={nav} className="arena-nav" aria-label="주요 메뉴">
      <span ref={indicator} className="arena-nav-indicator lg-glass" aria-hidden="true"/>
      {items.map(item => <Link key={item.key} href={item.href}
        aria-current={item.href === activeHref ? (item.href.startsWith('#') ? 'location' : 'page') : undefined}
        onNavigate={() => navigate.current?.(item.href)}>{item.label}</Link>)}
    </nav>
    {account && <div className="arena-account">{account}</div>}
  </header>;
}
