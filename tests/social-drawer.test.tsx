// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SocialDrawer } from '../src/components/social/social-drawer';
import { socialInviteGames, type SocialGame } from '../src/lib/social/inbox';
import type { SocialInbox } from '../src/components/social/social-inbox';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
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
