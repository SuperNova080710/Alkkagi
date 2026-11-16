'use client';

import { createSpring, springFrom, useRefraction, type Spring } from '@zakisheriff/liquid-glass';
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

type Bounds = { x: number; y: number; width: number; height: number };
type Transfer = { owner: symbol; key: string; bounds: Bounds; expires: number };
type Move = (key: string | undefined, navigating: boolean) => void;

// The header and game switcher can remount as Next changes pages. Each track
// carries its own last painted position to the destination.
const transfers = new Map<string, Transfer>();
const springConfig = springFrom(0.42, 0.59);
const surfaceShape = { kind: 'surface', bezel: 18, thickness: 24, strength: 1.4 } as const;
const lensShape = { kind: 'lens', bezel: 10, thickness: 13, strength: 0.9, zoom: 1.04 } as const;

const mix = (a: number, b: number, weight: number) => a + (b - a) * weight;

function equalBounds(a: Bounds | undefined, b: Bounds) {
  return a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

export function useArenaGlassSurface(ref: RefObject<HTMLElement | null>, enabled = true) {
  useRefraction(ref, surfaceShape, enabled && typeof ResizeObserver === 'function');
}

export function useArenaGlassIndicator<T extends HTMLElement>(
  activeKey: string | undefined, scope?: string, enabled = true,
) {
  const track = useRef<T>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const move = useRef<Move>(null);

  useRefraction(indicator, lensShape, enabled && typeof ResizeObserver === 'function');

  useLayoutEffect(() => {
    const menu = track.current;
    const lens = indicator.current;
    if (!enabled || !menu || !lens || typeof ResizeObserver !== 'function') return;

    const menuElement = menu;
    const indicatorElement = lens;
    const owner = Symbol();
    let selected: HTMLElement | undefined;
    let painted: Bounds | undefined;
    let destination: Bounds | undefined;
    let spring: Spring | undefined;
    let menuWidth = menu.clientWidth;
    let menuHeight = menu.clientHeight;

    function measure(option: HTMLElement): Bounds {
      const reference = menuElement.getBoundingClientRect();
      const rect = option.getBoundingClientRect();
      const height = Math.min(48, Math.max(1, rect.height - 4));
      return {
        x: rect.left - reference.left + 1,
        y: rect.top - reference.top + (rect.height - height) / 2,
        width: Math.max(1, rect.width - 2), height,
      };
    }

    function draw(box: Bounds) {
      const width = Math.min(menuWidth, Math.max(1, box.width));
      const height = Math.min(menuHeight, Math.max(1, box.height));
      const x = Math.max(0, Math.min(box.x, menuWidth - width));
      const y = Math.max(0, Math.min(box.y, menuHeight - height));
      painted = { x, y, width, height };
      indicatorElement.style.width = width + 'px';
      indicatorElement.style.height = height + 'px';
      indicatorElement.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      menuElement.dataset.indicatorReady = '';
      const transfer = scope ? transfers.get(scope) : undefined;
      if (transfer?.owner === owner) transfer.bounds = painted;
    }

    function select(option: HTMLElement, start?: Bounds) {
      selected?.removeAttribute('data-glass-selected');
      selected = option;
      selected.dataset.glassSelected = '';
      const end = measure(option);
      destination = end;
      spring?.stop();
      if (!start) {
        draw(end);
        return;
      }
      spring = createSpring(0, springConfig, (progress, velocity) => {
        const stretch = Math.max(-0.045, Math.min(0.095, velocity * 0.009));
        const width = mix(start.width, end.width, progress);
        const height = mix(start.height, end.height, progress);
        draw({
          x: mix(start.x, end.x, progress) - width * stretch / 2,
          y: mix(start.y, end.y, progress) + height * stretch / 3,
          width: width * (1 + stretch),
          height: height * (1 - stretch * 0.67),
        });
      });
      draw(start);
      spring.set(1);
    }

    function clearSelection() {
      spring?.stop();
      selected?.removeAttribute('data-glass-selected');
      selected = undefined;
      painted = undefined;
      delete menuElement.dataset.indicatorReady;
    }

    move.current = (key, navigating) => {
      const option = [...menu.querySelectorAll<HTMLElement>(':scope > [data-glass-option]')]
        .find(item => item.dataset.glassOption === key);
      if (!option || !key) {
        clearSelection();
        return;
      }
      const now = performance.now();
      const transfer = scope ? transfers.get(scope) : undefined;
      if (scope && transfer && transfer.expires <= now) transfers.delete(scope);
      if (!navigating && selected === option) return;

      let start = painted;
      if (scope && navigating && painted && selected !== option && !key.startsWith('#')) {
        transfers.set(scope, { owner, key, bounds: painted, expires: now + 2500 });
      } else if (scope && !navigating && transfer && transfer.key === key && transfer.expires > now) {
        transfers.delete(scope);
        start ??= transfer.bounds;
      }
      select(option, start);
    };

    const resize = new ResizeObserver(() => {
      menuWidth = menu.clientWidth;
      menuHeight = menu.clientHeight;
      if (selected && !equalBounds(destination, measure(selected))) select(selected);
    });
    resize.observe(menu);
    menu.querySelectorAll(':scope > [data-glass-option]').forEach(option => resize.observe(option));

    return () => {
      move.current = null;
      resize.disconnect();
      clearSelection();
    };
  }, [scope, enabled]);

  useLayoutEffect(() => {
    move.current?.(activeKey, false);
  }, [activeKey, enabled, scope]);

  const selectLink = useCallback((key: string) => { move.current?.(key, true); }, []);
  return { track, indicator, selectLink };
}
