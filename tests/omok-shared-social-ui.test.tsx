import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ArenaShell } from '../src/components/ui/arena';
afterEach(() => vi.unstubAllEnvs());
describe('#269 shared social navigation and safe Omok invitation', () => {
  it('uses the same /friends and /messages routes under shared flags', () => {
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('MESSAGES_UI_ENABLED', 'true');
    const html = renderToStaticMarkup(<ArenaShell current="lobby">테스트</ArenaShell>);
    expect(html).toContain('href="/friends"');
    expect(html).toContain('href="/messages"');
    expect(html).toContain('href="/profile"');
  });
  it('hides messenger when either feature gate is disabled', () => {
    vi.stubEnv('FRIENDS_UI_ENABLED', 'false');
    vi.stubEnv('MESSAGES_UI_ENABLED', 'true');
    expect(renderToStaticMarkup(<ArenaShell>테스트</ArenaShell>)).not.toContain('href="/messages"');
    vi.stubEnv('FRIENDS_UI_ENABLED', 'true');
    vi.stubEnv('MESSAGES_UI_ENABLED', 'false');
    expect(renderToStaticMarkup(<ArenaShell>테스트</ArenaShell>)).not.toContain('href="/messages"');
  });
  it('only exposes Omok host invitation with both flags; stays on Omok API routes', () => {
    const route = readFileSync(new URL('../src/app/omok/rooms/[id]/page.tsx', import.meta.url), 'utf8');
    const client = readFileSync(new URL('../src/components/omok/omok-casual-room-client.tsx', import.meta.url),'utf8');
    expect(route).toContain("process.env.FRIENDS_UI_ENABLED === 'true'");
    expect(route).toContain("process.env.ROOM_INVITES_UI_ENABLED === 'true'");
    expect(client).toContain("invitesEnabled && room.status === 'waiting'");
    expect(client).toContain("'/api/omok/invites'");
    expect(client).toContain("'/api/friends'");
    expect(client).not.toContain("'/api/room-invites'");
  });
});
