// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameSwitcher } from '../src/components/lobby/game-switcher';
import { ArenaGlassHeader } from '../src/components/ui/arena-glass-header';

vi.mock('@zakisheriff/liquid-glass', async importOriginal => ({
  ...await importOriginal<typeof import('@zakisheriff/liquid-glass')>(),
  useRefraction: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({ href, onNavigate, children, ...props }: {
    href: string; onNavigate?: () => void; children: ReactNode;
  }) => <a href={href} {...props} onClick={event => {
    event.preventDefault();
    onNavigate?.();
  }}>{children}</a>,
}));

const items = [
  { key: 'lobby', href: '/lobby', label: '로비' },
  { key: 'ranked', href: '/ranked', label: '랭킹' },
];
let frame: FrameRequestCallback | undefined;
let reduce: boolean;
beforeEach(() => {
  frame = undefined;
  reduce = false;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(350);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(76);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const href = this.getAttribute('href');
    if (href === '/ranked' || href === '/omok') return new DOMRect(128, 10, 84, 52);
    if (href === '/lobby') return new DOMRect(0, 10, 64, 52);
    return new DOMRect(0, 0, 350, 76);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('moves the glass indicator on navigation (reduced motion %s)', async reduced => {
  reduce = reduced;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ArenaGlassHeader items={items} activeHref="/lobby">한판아레나</ArenaGlassHeader>));
    const indicator = host.querySelector<HTMLElement>('.arena-nav-indicator');
    const ranked = host.querySelector<HTMLAnchorElement>('a[href="/ranked"]');
    const x = () => Number(/translate3d\(([\d.]+)px/.exec(indicator?.style.transform ?? '')?.[1]);
    expect(x()).toBe(1);
    await act(async () => ranked?.click());

    if (reduced) {
      expect(x()).toBe(129);
      expect(frame).toBeUndefined();
    } else {
      const began = performance.now();
      let farthest = x();
      for (let elapsed = 16; elapsed <= 1500; elapsed += 16) {
        const callback = frame;
        frame = undefined;
        callback?.(began + elapsed);
        farthest = Math.max(farthest, x());
      }
      expect(farthest).toBeGreaterThan(134);
      expect(x()).toBeCloseTo(129, 1);
    }
    expect(ranked?.hasAttribute('data-glass-selected')).toBe(true);
    expect(host.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/lobby');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('carries the game switcher lens into the next lobby', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const x = () => Number(/translate3d\(([\d.]+)px/.exec(
    host.querySelector<HTMLElement>('.arena-glass-indicator')?.style.transform ?? '',
  )?.[1]);
  function step(time: number) {
    const callback = frame;
    frame = undefined;
    callback?.(time);
  }
  try {
    await act(async () => root.render(<GameSwitcher key="old" current="alkkagi"/>));
    expect(x()).toBe(1);
    const omok = host.querySelector<HTMLAnchorElement>('a[href="/omok"]');
    await act(async () => omok?.click());
    const began = performance.now();
    step(began + 16);
    step(began + 32);
    const crossing = x();
    expect(crossing).toBeGreaterThan(1);
    expect(crossing).toBeLessThan(129);
    await act(async () => root.render(<GameSwitcher key="new" current="omok"/>));
    expect(x()).toBeCloseTo(crossing, 5);

    let peak = x();
    for (let elapsed = 48; elapsed <= 1500; elapsed += 16) {
      step(began + elapsed);
      peak = Math.max(peak, x());
    }
    expect(peak).toBeGreaterThan(129);
    expect(x()).toBeCloseTo(129, 1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
