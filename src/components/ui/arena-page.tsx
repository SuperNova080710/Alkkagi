'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';

export type ArenaSlideDirection = 'forward' | 'back';
const motionKey = 'arena:page-slide';
type Slide = { href: string; direction: ArenaSlideDirection; expires: number };
let pending: Slide | undefined;

// Link is still responsible for navigation. The hint only selects the direction.
export function prepareArenaPageSlide(href: string, direction: ArenaSlideDirection) {
  if (!href.startsWith('/') || href === window.location.pathname) return;
  pending = { href, direction, expires: Date.now() + 10000 };
  try {
    sessionStorage.setItem(motionKey, JSON.stringify(pending));
  } catch { /* The animation also works with storage disabled. */ }
}

function takePendingSlide(pathname: string) {
  let hint = pending;
  pending = undefined;
  try {
    const stored = sessionStorage.getItem(motionKey);
    sessionStorage.removeItem(motionKey);
    if (!hint && stored) hint = JSON.parse(stored) as Slide;
  } catch { /* A stale or inaccessible hint can be ignored. */ }
  return hint?.href === pathname && hint.expires > Date.now() ? hint.direction : undefined;
}

function cameFromArena(pathname: string) {
  if (!document.referrer) return false;
  const referrer = new URL(document.referrer);
  return referrer.origin === window.location.origin && referrer.pathname !== pathname;
}

export function ArenaPageMotion() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!pathname || previous.current === pathname) return;
    const from = previous.current;
    previous.current = pathname;
    const direction = takePendingSlide(pathname);
    if (!direction && !from && !cameFromArena(pathname)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const content = document.getElementById('arena-content');
    if (!content) return;
    // A shared DOM node can receive two navigation commits within one animation.
    if (content.dataset.arenaPageSlide) {
      delete content.dataset.arenaPageSlide;
      void content.offsetWidth;
    }
    content.dataset.arenaPageSlide = direction ?? 'forward';
    function finish(event: AnimationEvent) {
      if (event.target === content && event.animationName === 'arena-page-slide') clear();
    }
    function clear() {
      if (!content) return;
      delete content.dataset.arenaPageSlide;
      content.removeEventListener('animationend', finish);
      content.removeEventListener('animationcancel', finish);
    }
    content.addEventListener('animationend', finish);
    content.addEventListener('animationcancel', finish);
    return clear;
  }, [pathname]);

  return null;
}
