'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

export type ArenaSlideDirection = 'forward' | 'back';
let pending: { href: string; direction: ArenaSlideDirection; expires: number } | undefined;

export function prepareArenaPageSlide(href: string, direction: ArenaSlideDirection) {
  pending = href.startsWith('/') && href !== window.location.pathname
    ? { href, direction, expires: Date.now() + 5000 } : undefined;
}

export function ArenaPage({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const previous = useRef<Animation>(null);

  useLayoutEffect(() => {
    const content = main.current;
    if (!pending || !content) return;
    if (pending.expires < Date.now()) { pending = undefined; return; }
    if (pending.href !== window.location.pathname) return;
    const { direction } = pending;
    pending = undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !content.animate) return;

    const style = getComputedStyle(content);
    const duration = Number.parseFloat(style.getPropertyValue('--arena-panel-duration'));
    if (!(duration > 0)) return;
    previous.current?.cancel();
    const animation = content.animate(
      [{ translate: (direction === 'forward' ? '12px' : '-12px') + ' 0', opacity: .72 },
        { translate: '0 0', opacity: 1 }],
      { duration,
        easing: style.getPropertyValue('--arena-panel-ease').trim() },
    );
    animation.id = 'arena-page-slide';
    previous.current = animation;
  }, [children]);

  return <main ref={main} id="arena-content" tabIndex={-1}>{children}</main>;
}
