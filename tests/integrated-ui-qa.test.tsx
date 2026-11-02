import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  dmValidatedRequest, isDmFriends, isDmInbox, isDmHistory, isDmSent,
  DmApiError, canSendDm, dmBodyLength, dmErrorMessage,
} from '../src/components/messages/message-api';
import { ExperienceSummary, isExperienceData, type ExperienceData } from '../src/components/experience/experience-panel';
import { CosmeticInventoryResult } from '../src/components/cosmetics/cosmetic-wardrobe';
import { GamePieces } from '../src/components/game/game-pieces';
import { RADIUS, type Board } from '../src/lib/game/engine';
import { fetchMatchCosmeticLooks, DEFAULT_MATCH_LOOK } from '../src/components/game/use-match-cosmetics';
import { validInviteFriends, validReceivedRoomInvites, validSentRoomInvites } from '../src/components/rooms/room-invite-api';

const playerA = '11111111-1111-4111-8111-111111111111';
const playerB = '22222222-2222-4222-8222-222222222222';
const threadId = '33333333-3333-4333-8333-333333333333';
const now = '2026-11-02T01:00:00Z';
const message = { id: '9007199254740993123', senderId: playerA, body: '마지막 메시지입니다', createdAt: now };
const inbox = [{
  threadId, userId: playerB, nickname: '친구',
  lastAt: now, lastMessage: message, unreadCount: 3,
}];
const friends = { friends: [{ id: playerB, nickname: '친구' }] };
const history = { threadId, messages: [message], hasMore: false };
const send = { ...message, threadId, alreadySent: false };
const reward = { id: '1', sourceKind: 'ranked', sourceId: threadId,
  outcome: 'win', earnedXp: 70, createdAt: now };
const xp: ExperienceData = { userId: playerA, level: 2, totalXp: 180,
  currentLevelXp: 80, nextLevelCost: 300, nextLevelAt: 400, recentRewards: [reward] };
const wardrobe = {
  loadout: { pieceCode: 'piece-forest', avatarCode: 'avatar-orbit' },
  rankedWins: 1, level: 2, items: [
    { code: 'piece-forest', slot: 'piece', name: '숲빛 알',
      description: '랭크 1승', unlockKind: 'ranked_wins', requiredValue: 1,
      owned: true, equipped: true, unlockedAt: now },
  ],
};
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Integrated UI QA: #104, #179, #139, #149, #162 and #165', () => {
  it('#139 matches actual SQL inbox JSON and rejects a string where lastMessage object is required', async () => {
    expect(isDmFriends(friends)).toBe(true);
    expect(isDmInbox(inbox)).toBe(true);
    expect(isDmInbox([{ ...inbox[0], lastMessage: 'message text' }])).toBe(false);
    const source = readFileSync(new URL('../src/components/messages/messenger-view.tsx', import.meta.url), 'utf8');
    expect(source).toContain('item.recent?.lastMessage?.body');
    expect(source).not.toContain("item.recent?.lastMessage ?? '새 대화 시작하기'");
    const fetcher = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: inbox }),
    });
    vi.stubGlobal('fetch', fetcher);
    const data = await dmValidatedRequest('/api/messages', isDmInbox);
    expect(data[0].lastMessage?.body).toBe('마지막 메시지입니다');
    expect(fetcher).toHaveBeenCalledWith('/api/messages',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
  });

  it('#139 rejects malformed friends, inbox and nested lastMessage values before rendering', async () => {
    const badFriends = [{ friends: [null] }, { friends: [{ id: playerB, nickname: {} }] }, null];
    for (const candidate of badFriends) expect(isDmFriends(candidate)).toBe(false);
    const malformed = [
      null, [null], [{ ...inbox[0], userId: 12 }],
      [{ ...inbox[0], nickname: { bad: true } }],
      [{ ...inbox[0], lastAt: {} }],
      [{ ...inbox[0], lastMessage: { ...message, body: {} } }],
      [{ ...inbox[0], unreadCount: -5 }],
      [{ ...inbox[0], unreadCount: Infinity }],
    ];
    for (const value of malformed) expect(isDmInbox(value)).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: [{ ...inbox[0], lastMessage: {} }] }),
    }));
    await expect(dmValidatedRequest('/api/messages', isDmInbox)).rejects.toMatchObject({
      status: 503, code: 'DM_SERVICE_UNAVAILABLE',
    });
    expect(dmErrorMessage(new DmApiError(503, 'PRIVATE_SQL_SECRET'))).not.toContain('PRIVATE_SQL_SECRET');
  });

  it('#139 validates empty threads, bigint IDs, safe text, send and bad pagination', () => {
    expect(isDmHistory({ threadId: null, messages: [], hasMore: false })).toBe(true);
    expect(isDmHistory(history)).toBe(true);
    expect(isDmSent(send)).toBe(true);
    expect(isDmSent({ ...send, alreadySent: 'yes' })).toBe(false);
    expect(isDmHistory({ ...history, messages: [null] })).toBe(false);
    expect(isDmHistory({ threadId: null, messages: [message], hasMore: true })).toBe(false);
    expect(isDmHistory({ ...history, messages: [{ ...message, id: 9007199254740993123 }] })).toBe(false);
    expect(dmBodyLength('😀'.repeat(500))).toBe(500);
    expect(canSendDm('😀'.repeat(500))).toBe(true);
    expect(canSendDm('😀'.repeat(501))).toBe(false);
  });

  it('#149 preserves private reward history while exposing only XP progress publicly', () => {
    expect(isExperienceData(xp)).toBe(true);
    expect(isExperienceData({ ...xp, recentRewards: [null] })).toBe(false);
    const publicHtml = renderToStaticMarkup(<ExperienceSummary data={xp}/>);
    const privateHtml = renderToStaticMarkup(<ExperienceSummary data={xp} isSelf/>);
    expect(publicHtml).toContain('Lv.2');
    expect(publicHtml).not.toContain('최근 획득 기록');
    expect(publicHtml).not.toContain('랭크전 · 승리');
    expect(privateHtml).toContain('랭크전 · 승리');
    expect(privateHtml).toContain('aria-label="다음 레벨까지 경험치 진행률"');
  });

  it('#162 rejects malformed inventory and renders only server-owned equipped items', () => {
    const bad = { ...wardrobe, items: [{ ...wardrobe.items[0], owned: 'yes' }] };
    const invalid = renderToStaticMarkup(<CosmeticInventoryResult value={bad} onEquip={() => {}}/>);
    expect(invalid).toContain('아이템 정보 형식이 올바르지 않습니다');
    expect(invalid).not.toContain('장착하기');
    const valid = renderToStaticMarkup(<CosmeticInventoryResult value={wardrobe} onEquip={() => {}}/>);
    expect(valid).toContain('숲빛 알');
    expect(valid).toContain('장착 중');
    expect(valid).not.toContain('아이템 정보 형식이 올바르지 않습니다');
  });

  it('#165 keeps identical positions/radius/team strokes with cosmetics on and off', () => {
    const board: Board = { pieces: [
      { id: 'a', owner: playerA, x: 175, y: 250 },
      { id: 'b', owner: playerB, x: 625, y: 250 },
    ] };
    const classic = renderToStaticMarkup(<svg><GamePieces board={board}
      firstPlayerId={playerA} viewerId={playerA}/></svg>);
    const styled = renderToStaticMarkup(<svg><GamePieces board={board}
      firstPlayerId={playerA} viewerId={playerA} cosmetics={{
        [playerA]: { pieceCode: 'piece-forest', avatarCode: 'avatar-classic' },
        [playerB]: { pieceCode: 'piece-starlight', avatarCode: 'avatar-orbit' },
      }}/></svg>);
    for (const html of [classic, styled]) {
      expect(html).toContain('cx="175" cy="250"');
      expect(html).toContain('cx="625" cy="250"');
      expect(html.match(new RegExp('r="' + RADIUS + '"', 'g'))).toHaveLength(2);
      expect(html).toContain('stroke="#fcd34d"');
      expect(html).toContain('stroke="#93c5fd"');
    }
    expect(styled).toContain('piece-forest');
    expect(styled).toContain('piece-starlight');
  });

  it('#165 defaults inaccessible opponent and own service failure without blocking the game', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => ({
      ok: false, status: path.includes('/players/') ? 404 : 503,
      json: async () => ({ error: 'PRIVATE_SQL_SECRET' }),
    })));
    expect(await fetchMatchCosmeticLooks(playerA, playerB)).toEqual({
      [playerA]: DEFAULT_MATCH_LOOK, [playerB]: DEFAULT_MATCH_LOOK,
    });
  });

  it('#179 sanitizes malformed friend/invites and retains valid friend data', () => {
    const broken = { friends: [null, { id: playerB, nickname: {} }, { id: playerB, nickname: '친구' }] };
    expect(validInviteFriends(broken)).toEqual([{ id: playerB, nickname: '친구' }]);
    expect(validReceivedRoomInvites([{ id: null, inviterNickname: '친구' }])).toEqual([]);
    expect(validSentRoomInvites([{ id: null, inviteeNickname: { malformed: true } }])).toEqual([]);
  });

  it('#104 preserves accessible scroll and shared 3D UI without globally hiding content', () => {
    const css = readFileSync(new URL('../src/app/arena.css', import.meta.url), 'utf8');
    expect(css).toContain('/* Issue #104: responsive viewport and zoom safety');
    expect(css).toContain('/* UI V6 (#179)');
    expect(css).toContain('.arena-room-wait-layout');
    expect(css).toContain('.arena-dm-messages');
    expect(css).toContain('.arena-xp-rewards');
    expect(css).toContain('.arena-cosmetics-grid');
    expect(css).not.toMatch(/body\s*\{\s*overflow:\s*hidden/);
    const page = readFileSync(new URL('../src/app/rooms/[id]/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("process.env.ROOM_INVITES_UI_ENABLED==='true'");
    expect(page).toContain("cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}");
  });
});
