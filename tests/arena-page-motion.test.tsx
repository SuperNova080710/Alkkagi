// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ArenaPageMotion, prepareArenaPageSlide } from '../src/components/ui/arena-page';

const navigation = vi.hoisted(() => ({ pathname: '/lobby' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

let reduceMotion = false;
beforeEach(() => {
  navigation.pathname = '/lobby';
  sessionStorage.clear();
  reduceMotion = false;
  vi.stubGlobal('matchMedia', () => ({ matches: reduceMotion }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('slides when the Next route commits even before the browser address changes', async () => {
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  const render = () => root.render(<><main key={navigation.pathname} id="arena-content"/><ArenaPageMotion/></>);
  try {
    await act(async () => render());
    expect(host.querySelector('main')?.hasAttribute('data-arena-page-slide')).toBe(false);
    prepareArenaPageSlide('/ranked', 'back');
    navigation.pathname = '/ranked';
    expect(window.location.pathname).not.toBe('/ranked');
    await act(async () => render());
    expect(host.querySelector('main')?.getAttribute('data-arena-page-slide')).toBe('back');

    navigation.pathname = '/friends';
    await act(async () => render());
    expect(host.querySelector('main')?.getAttribute('data-arena-page-slide')).toBe('forward');

    reduceMotion = true;
    navigation.pathname = '/profile';
    await act(async () => render());
    expect(host.querySelector('main')?.hasAttribute('data-arena-page-slide')).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
