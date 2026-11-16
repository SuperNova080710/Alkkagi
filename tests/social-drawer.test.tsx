// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SocialDrawer } from '../src/components/social/social-drawer';
import { socialInviteGames, type SocialGame } from '../src/lib/social/inbox';
import type { SocialInbox } from '../src/components/social/social-inbox';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@zakisheriff/liquid-glass', async importOriginal => ({
  ...await importOriginal<typeof import('@zakisheriff/liquid-glass')>(),
  useRefraction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const roomId = '44444444-4444-4444-8444-444444444444';
const games = Object.keys(socialInviteGames) as SocialGame[];
const inbox: SocialInbox = {
  userId, requests: [], messages: [], inviteGames: games, unavailableGames: [],
  invites: games.map(game => ({
    game, id, roomId, inviterId: otherId, inviterNickname: '친구 A',
    createdAt: '2026-11-16T00:00:00Z', expiresAt: '2026-11-16T00:05:00Z',
  })),
};

const dialogPrototype = HTMLDialogElement.prototype;
const dialogMethods = {
  showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); },
  close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  },
};
const methods = Object.keys(dialogMethods) as Array<keyof typeof dialogMethods>;
const original = methods.map(method => Object.getOwnPropertyDescriptor(dialogPrototype, method));

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  for (const method of methods)
    Object.defineProperty(dialogPrototype, method, { configurable: true, value: dialogMethods[method] });
});

afterEach(() => {
  methods.forEach((method, index) => {
    const descriptor = original[index];
    if (descriptor) Object.defineProperty(dialogPrototype, method, descriptor);
    else Reflect.deleteProperty(dialogPrototype, method);
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  push.mockReset();
});

it.each(games)('opens one inbox and accepts a %s invite from another game', async game => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ data: { inviteId: id, status: 'accepted', roomId } }),
  });
  vi.stubGlobal('fetch', fetcher);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const refresh = vi.fn();
  try {
    await act(async () => root.render(<SocialDrawer inbox={inbox} pathname={game === 'omok' ? '/chess' : '/omok'}
      onRefresh={refresh} loadFailed={false}/>));
    expect(host.querySelector('.arena-social-dot')).not.toBeNull();
    const launcher = host.querySelector<HTMLButtonElement>('.arena-social-launcher');
    await act(async () => launcher?.click());
    expect(host.querySelector('dialog')?.open).toBe(true);
    expect(host.querySelectorAll('.arena-social-game')).toHaveLength(3);

    const button = [...host.querySelectorAll('button')].find(control =>
      control.getAttribute('aria-label') === socialInviteGames[game].label + ' 친구 A님의 초대 수락');
    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(fetcher).toHaveBeenCalledWith(socialInviteGames[game].api + '/' + id + '/respond',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ accept: true }) }));
    expect(push).toHaveBeenCalledExactlyOnceWith(socialInviteGames[game].rooms + roomId);
    expect(host.querySelector('dialog')?.open).toBe(false);
    expect(document.activeElement).toBe(launcher);
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('moves the glass tab and dismisses only a complete backdrop click', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(52);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'DIALOG') return new DOMRect(12, 100, 350, 620);
    if (this.dataset.glassOption === 'invites') return new DOMRect(100, 4, 95, 44);
    if (this.dataset.glassOption === 'requests') return new DOMRect(200, 4, 95, 44);
    return new DOMRect(0, 0, 300, 52);
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SocialDrawer inbox={inbox} pathname="/lobby"
      onRefresh={vi.fn()} loadFailed={false}/>));
    const launcher = host.querySelector<HTMLButtonElement>('.arena-social-launcher')!;
    await act(async () => launcher.click());
    const dialog = host.querySelector('dialog')!;
    const requests = dialog.querySelector<HTMLButtonElement>('button[data-glass-option="requests"]')!;
    const indicator = dialog.querySelector<HTMLElement>('.arena-glass-indicator')!;
    expect(indicator.style.transform).toContain('translate3d(101px,');
    await act(async () => requests.click());
    expect(requests.getAttribute('aria-pressed')).toBe('true');
    expect(indicator.style.transform).toContain('translate3d(201px,');
    expect(dialog.open).toBe(true);

    const event = (type: string, x: number) =>
      new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 200 });
    await act(async () => {
      requests.dispatchEvent(event('pointerdown', 88));
      dialog.dispatchEvent(event('click', 450));
    });
    expect(dialog.open).toBe(true);
    await act(async () => {
      dialog.dispatchEvent(event('pointerdown', 450));
      dialog.dispatchEvent(event('click', 450));
    });
    expect(dialog.open).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(launcher);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('keeps the back control next to the nickname and returns focus to the friend list', async () => {
  const fetcher = vi.fn(async (path: string) => ({
    ok: true,
    json: async () => ({ data: path === '/api/friends' ? { friends: [{ id: otherId, nickname: '친구 A' }] }
      : path === '/api/messages' ? [] : { threadId: id, messages: [], hasMore: false } }),
  }));
  vi.stubGlobal('fetch', fetcher);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SocialDrawer inbox={{ ...inbox, invites: [] }} pathname="/lobby"
      onRefresh={vi.fn()} loadFailed={false}/>));
    await act(async () => host.querySelector<HTMLButtonElement>('.arena-social-launcher')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.arena-dm-peer')!.click());
    const heading = host.querySelector('.arena-dm-thread-heading')!;
    const back = heading.querySelector<HTMLButtonElement>('button[aria-label="대화 목록으로 돌아가기"]')!;
    expect(back.textContent).toBe('<');
    expect(back.nextElementSibling?.textContent).toBe('친구 A');
    expect(heading.textContent).not.toContain('친구 전용 1:1 메시지');
    expect(document.activeElement).toBe(back);
    expect(host.querySelector('.arena-dm-compose textarea')).not.toBeNull();

    await act(async () => back.click());
    expect(host.querySelector('.arena-dm-thread')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.arena-dm-peer'));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
