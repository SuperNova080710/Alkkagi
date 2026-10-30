import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { GamePieces } from '../src/components/game/game-pieces';
import { GameIdentityHeading } from '../src/components/game/game-identity-heading';
import { getPlayerIdentities, type IdentityMatch } from '../src/lib/game/player-identity';
import { RADIUS, type Board } from '../src/lib/game/engine';
import {
  fetchMatchCosmeticLooks, safeMatchCosmeticLook, DEFAULT_MATCH_LOOK,
} from '../src/components/game/use-match-cosmetics';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const board: Board = { pieces: [
  { id: 'a1', owner: a, x: 175, y: 250 },
  { id: 'b1', owner: b, x: 625, y: 250 },
] };
const match: IdentityMatch = {
  player1_id: a, player2_id: b, turn_user_id: a, winner_id: null, status: 'active',
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('cosmetic piece rendering without game physics changes', () => {
  it('renders original orange/blue board and marks with no loadout', () => {
    const html = renderToStaticMarkup(<svg><GamePieces board={board} firstPlayerId={a} viewerId={a}/></svg>);
    expect(html).toContain('fill="#f59e0b"');
    expect(html).toContain('fill="#60a5fa"');
    expect(html).toContain('stroke="#fcd34d"');
    expect(html).toContain('stroke="#93c5fd"');
    expect(html.match(/data-piece-skin="piece-classic"/g)).toHaveLength(2);
    expect(html.match(/>나<\/text>/g)).toHaveLength(1);
    expect(html.match(new RegExp('r="' + RADIUS + '"', 'g'))).toHaveLength(2);
    expect(html).not.toContain('stroke-dasharray');
  });

  it('applies forest/star styles to owners while preserving team borders and positions', () => {
    const cosmetics = {
      [a]: { pieceCode: 'piece-forest', avatarCode: 'avatar-orbit' },
      [b]: { pieceCode: 'piece-starlight', avatarCode: 'avatar-bronze' },
    };
    const html = renderToStaticMarkup(<svg><GamePieces board={board} firstPlayerId={a}
      viewerId={b} cosmetics={cosmetics}/></svg>);
    expect(html).toContain('data-piece-skin="piece-forest"');
    expect(html).toContain('data-piece-skin="piece-starlight"');
    expect(html).toContain('radialGradient');
    expect(html).toContain('cx="175" cy="250"');
    expect(html).toContain('cx="625" cy="250"');
    expect(html).toContain('stroke="#fcd34d"');
    expect(html).toContain('stroke="#93c5fd"');
    expect(html.match(/>나<\/text>/g)).toHaveLength(1);
    expect(html.match(new RegExp('r="' + RADIUS + '"', 'g'))).toHaveLength(2);
  });

  it('shows selected avatars in HUD only when cosmetics enabled, without altering turn labels', () => {
    const players = getPlayerIdentities(match, a, [
      { seat: 1, nickname: '나' }, { seat: 2, nickname: '친구' },
    ], board);
    const cosmetics = {
      [a]: { pieceCode: 'piece-forest', avatarCode: 'avatar-orbit' },
      [b]: { pieceCode: 'piece-classic', avatarCode: 'avatar-bronze' },
    };
    const enabled = renderToStaticMarkup(<GameIdentityHeading match={match} viewerId={a}
      players={players} mode="ranked" animating={false} pending={false} remaining={60}
      cosmetics={cosmetics} cosmeticsEnabled/>);
    expect(enabled).toContain('arena-cosmetic-art--avatar-orbit');
    expect(enabled).toContain('arena-cosmetic-art--avatar-bronze');
    expect(enabled).toContain('현재 턴');
    expect(enabled).toContain('내 알 · 주황색 · 선공');
    const disabled = renderToStaticMarkup(<GameIdentityHeading match={match} viewerId={a}
      players={players} mode="ranked" animating={false} pending={false} remaining={60}/>);
    expect(disabled).not.toContain('game-avatar-cosmetic');
  });

  it('rejects unknown/malformed codes and falls back to safe starter appearance', () => {
    expect(safeMatchCosmeticLook(null)).toEqual(DEFAULT_MATCH_LOOK);
    expect(safeMatchCosmeticLook({ pieceCode: '../secret', avatarCode: 'piece-forest' }))
      .toEqual(DEFAULT_MATCH_LOOK);
    expect(safeMatchCosmeticLook({ pieceCode: 'piece-starlight', avatarCode: 'avatar-orbit' }))
      .toEqual({ pieceCode: 'piece-starlight', avatarCode: 'avatar-orbit' });
    const html = renderToStaticMarkup(<svg><GamePieces board={board} firstPlayerId={a}
      viewerId={a} cosmetics={{[a]:{pieceCode:'fake',avatarCode:'avatar-classic'}}}/></svg>);
    expect(html).toContain('fill="#f59e0b"');
    expect(html).not.toContain('fake');
  });

  it('reads viewer private inventory and opponent public cosmetics, preserving fallback on 404', async () => {
    const request = vi.fn(async (url: string) => url === '/api/cosmetics/me'
      ? { ok: true, json: async () => ({ data: {
        loadout: { pieceCode: 'piece-forest', avatarCode: 'avatar-orbit' },
        rankedWins: 0, level: 1, items: [],
      } }) }
      : { ok: false, status: 404, json: async () => ({ error: 'PLAYER_NOT_FOUND' }) });
    vi.stubGlobal('fetch', request);
    expect(await fetchMatchCosmeticLooks(a, b)).toEqual({
      [a]: { pieceCode: 'piece-forest', avatarCode: 'avatar-orbit' },
      [b]: DEFAULT_MATCH_LOOK,
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith('/api/cosmetics/me',
      expect.objectContaining({credentials:'same-origin',cache:'no-store'}));
    expect(request).toHaveBeenCalledWith('/api/cosmetics/players/'+b,
      expect.objectContaining({credentials:'same-origin',cache:'no-store'}));
  });

  it('never fetches a fake AI public account, even when my own API fails', async () => {
    const request = vi.fn(async () => { throw new Error('not installed'); });
    vi.stubGlobal('fetch', request);
    expect(await fetchMatchCosmeticLooks(a, null)).toEqual({ [a]: DEFAULT_MATCH_LOOK });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/api/cosmetics/me');
  });

  it('keeps Board/Shot/physics and SVG viewBox geometry untouched in all modes', () => {
    for (const path of [
      '../src/components/game/game-board.tsx',
      '../src/components/game/ai-game-board.tsx',
    ]) {
      const code = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(code).toContain('<GamePieces board={board}');
      expect(code).toContain('viewBox="0 0 800 500"');
      expect(code).toContain('useMatchCosmetics(');
    }
    for (const page of [
      '../src/app/rooms/[id]/page.tsx',
      '../src/app/ranked/[id]/page.tsx',
      '../src/app/rooms/[id]/ai/page.tsx',
    ]) expect(readFileSync(new URL(page, import.meta.url), 'utf8'))
      .toContain("cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}");
  });
});
