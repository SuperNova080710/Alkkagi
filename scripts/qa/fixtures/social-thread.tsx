import { createRoot } from 'react-dom/client';
import { SocialDrawer } from '../../../src/components/social/social-drawer';

const userId = '11111111-1111-4111-8111-111111111111';
const peer = { id: '22222222-2222-4222-8222-222222222222', nickname: '친구의 긴 닉네임'.repeat(6) };
const thread = {
  threadId: '33333333-3333-4333-8333-333333333333',
  messages: Array.from({ length: 30 }, (_, i) => ({
    id: String(30 - i), senderId: userId, body: '메시지 내용 '.repeat(6), createdAt: '2026-11-16T00:00:00Z',
  })),
  hasMore: true,
};

async function waitFor<T extends Element>(parent: ParentNode, selector: string): Promise<T> {
  const deadline = performance.now() + 4000;
  while (performance.now() < deadline) {
    const element = parent.querySelector<T>(selector);
    if (element) return element;
    await new Promise(requestAnimationFrame);
  }
  throw new Error('Missing element: ' + selector);
}

async function verify() {
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  const originalFetch = window.fetch;
  const focus = document.activeElement;
  try {
    window.fetch = (input, init) => {
      const path = typeof input === 'string' ? input.split('?')[0] : '';
      const fixtures: Record<string, unknown> = {
        '/api/friends': { friends: [peer] },
        '/api/messages': [],
        ['/api/messages/' + peer.id]: thread,
      };
      return Object.hasOwn(fixtures, path)
        ? Promise.resolve(Response.json({ data: fixtures[path] }))
        : originalFetch.call(window, input, init);
    };
    root.render(<SocialDrawer inbox={{ userId, messages: [], requests: [],
      invites: [], inviteGames: ['alkkagi'], unavailableGames: [] }}
      pathname="/lobby" loadFailed={false} onRefresh={() => {}}/>);
    (await waitFor<HTMLButtonElement>(host, '.arena-social-launcher')).click();
    (await waitFor<HTMLButtonElement>(host, '.arena-dm-peer')).click();
    const history = await waitFor<HTMLOListElement>(host, '.arena-dm-messages');
    const body = await waitFor<HTMLDivElement>(host, '.arena-social-content');
    const panel = await waitFor<HTMLElement>(host, '.arena-dm-thread');
    const composer = await waitFor<HTMLFormElement>(host, '.arena-dm-compose');
    await new Promise(resolve => setTimeout(resolve, 380));
    const bounds = body.getBoundingClientRect();
    const input = composer.querySelector('textarea')?.getBoundingClientRect();
    const send = composer.querySelector('button')?.getBoundingClientRect();
    if (!input || !send || input.top < bounds.top || send.bottom > bounds.bottom + 1)
      throw new Error('Input or send button is outside the drawer body');
    if (body.scrollHeight > body.clientHeight + 1 || panel.scrollHeight > panel.clientHeight + 1)
      throw new Error('Drawer or thread panel scrolls instead of the message list');
    if (history.scrollHeight <= history.clientHeight || history.clientHeight < 48)
      throw new Error('Long message list has no usable scroll area (' + history.clientHeight + 'px of ' + body.clientHeight + 'px)');
    history.scrollTop = 0;
    history.scrollTop += 60;
    if (history.scrollTop === 0 || send.bottom !== composer.querySelector('button')?.getBoundingClientRect().bottom)
      throw new Error('Scrolling the history moves the composer');
    const back = await waitFor<HTMLButtonElement>(host, '.arena-dm-thread-heading .arena-social-back');
    if (back.textContent !== '<' || back.nextElementSibling?.textContent !== peer.nickname)
      throw new Error('Back control is not beside the nickname');
    back.click();
    await waitFor(host, '.arena-dm-peer');
    return 'PASS';
  } finally {
    root.unmount();
    host.remove();
    document.getElementById('qa-messenger-style')?.remove();
    window.fetch = originalFetch;
    if (focus instanceof HTMLElement) focus.focus({ preventScroll: true });
  }
}

void verify().then(result => { document.documentElement.dataset.qaMessenger = result; })
  .catch((error: unknown) => { document.documentElement.dataset.qaMessenger = String(error); });
