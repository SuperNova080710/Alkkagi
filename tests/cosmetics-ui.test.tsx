import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
}));
vi.mock('@/lib/auth/user', () => ({ requireUser }));

import CosmeticsPage, { metadata } from '../src/app/cosmetics/page';
import { CosmeticCollection, CosmeticInventoryResult, CosmeticWardrobe } from '../src/components/cosmetics/cosmetic-wardrobe';
import { CosmeticPreview } from '../src/components/cosmetics/cosmetic-preview';
import {
  cosmeticErrorText, cosmeticRequest, cosmeticUnlockLabel, equipCosmetic,
  safeCosmeticCode, isCosmeticInventory, CosmeticRequestError, type CosmeticInventory,
} from '../src/components/cosmetics/cosmetic-api';
import { ArenaShell } from '../src/components/ui/arena';

const inventory: CosmeticInventory = {
  loadout: { pieceCode: 'piece-classic', avatarCode: 'avatar-classic' },
  level: 1, rankedWins: 0,
  items: [
    { code: 'piece-classic', slot: 'piece', name: '기본 알', description: '처음부터',
      unlockKind: 'starter', requiredValue: 0, owned: true, equipped: true, unlockedAt: '2026-10-30' },
    { code: 'piece-forest', slot: 'piece', name: '숲빛 알', description: '랭크 1승',
      unlockKind: 'ranked_wins', requiredValue: 1, owned: false, equipped: false, unlockedAt: null },
    { code: 'piece-starlight', slot: 'piece', name: '별빛 알', description: '레벨 3',
      unlockKind: 'xp_level', requiredValue: 3, owned: false, equipped: false, unlockedAt: null },
    { code: 'avatar-classic', slot: 'avatar', name: '기본 캐릭터', description: '처음부터',
      unlockKind: 'starter', requiredValue: 0, owned: true, equipped: true, unlockedAt: '2026-10-30' },
    { code: 'avatar-bronze', slot: 'avatar', name: '청동 캐릭터', description: '랭크 3승',
      unlockKind: 'ranked_wins', requiredValue: 3, owned: false, equipped: false, unlockedAt: null },
    { code: 'avatar-orbit', slot: 'avatar', name: '궤도 캐릭터', description: '레벨 2',
      unlockKind: 'xp_level', requiredValue: 2, owned: false, equipped: false, unlockedAt: null },
  ],
};
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('cosmetics wardrobe UI and safety contract', () => {
  it('requires an authenticated session and keeps unprovisioned UI off by default', async () => {
    vi.stubEnv('COSMETICS_UI_ENABLED', '');
    const hidden = renderToStaticMarkup(await CosmeticsPage());
    expect(hidden).toContain('꾸미기 기능 준비 중');
    expect(hidden).not.toContain('보유 아이템을 불러오고 있습니다');
    expect(hidden).not.toContain('href="/cosmetics"');
    expect(requireUser).toHaveBeenCalledOnce();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('shows the wardrobe and navigation only when explicitly enabled', async () => {
    vi.stubEnv('COSMETICS_UI_ENABLED', 'true');
    const page = renderToStaticMarkup(await CosmeticsPage());
    expect(page).toContain('꾸미기');
    expect(page).toContain('href="/cosmetics"');
    expect(page).toContain('aria-current="page"');
    expect(page).toContain('보유 아이템을 불러오고 있습니다');
    expect(page).not.toContain('꾸미기 기능 준비 중');
    const shell = renderToStaticMarkup(<ArenaShell>홈</ArenaShell>);
    expect(shell).toContain('href="/cosmetics"');
  });

  it('blocks the wardrobe when authentication fails', async () => {
    requireUser.mockRejectedValueOnce(new Error('login redirect'));
    await expect(CosmeticsPage()).rejects.toThrow('login redirect');
  });

  it('renders all 6 server catalog items and locked items cannot be equipped', () => {
    const html = renderToStaticMarkup(<CosmeticCollection inventory={inventory} onEquip={() => {}}/>);
    expect(html).toContain('나만의 알');
    expect(html).toContain('나만의 캐릭터');
    expect(html).toContain('랭크 1승 필요 · 현재 0승');
    expect(html).toContain('레벨 3 필요 · 현재 Lv.1');
    expect(html).not.toContain('지원 준비 중');
    expect(html.match(/aria-label="[^"]+ 잠김"/g)).toHaveLength(4);
    expect(html.match(/aria-label="[^"]+ 장착 중"/g)).toHaveLength(2);
    expect(html).toContain('disabled=""');
    expect(html).toContain('기본 캐릭터');
    expect(html).toContain('별빛 알');
  });

  it('renders owned but unequipped item as actionable, never computes unlock locally', () => {
    const data: CosmeticInventory = {
      ...inventory, rankedWins: 0,
      items: inventory.items.map(item => item.code === 'piece-forest' ? { ...item, owned: true } : item),
    };
    const html = renderToStaticMarkup(<CosmeticCollection inventory={data} onEquip={() => {}}/>);
    expect(html).toContain('aria-label="숲빛 알 장착하기"');
    // Ownership stays authoritative even if the server ranked wins count has dropped back to 0.
    expect(html).toContain('랭크 1승 필요 · 현재 0승');
    expect(cosmeticUnlockLabel(inventory.items[2], 0, 1)).toContain('레벨 3');
  });

  it('rejects malformed inventory JSON before rendering any nested item rows', () => {
    expect(isCosmeticInventory(inventory)).toBe(true);
    for (const bad of [
      null, 'bad', {}, { ...inventory, items: 'broken' },
      { ...inventory, items: [null] },
      { ...inventory, items: [{ ...inventory.items[0], code: null }] },
      { ...inventory, items: [{ ...inventory.items[0], owned: false, equipped: true }] },
      { ...inventory, items: [{ ...inventory.items[0], slot: 'wrong' }] },
      { ...inventory, items: [{ ...inventory.items[0], name: null }] },
      { ...inventory, loadout: 'broken' },
      { ...inventory, loadout: { avatarCode: null, pieceCode: 'piece-classic' } },
      { ...inventory, level: NaN },
      { ...inventory, rankedWins: -1 },
    ]) expect(isCosmeticInventory(bad)).toBe(false);
  });

  it('renders a neutral error for malformed server JSON and never renders partial inventory', () => {
    const invalid: unknown[] = [
      null, {}, { ...inventory, items: [null] },
      { ...inventory, items: { bad: true } },
      { ...inventory, loadout: null },
      { ...inventory, items: [{ ...inventory.items[0], owned: 'yes' }] },
      { ...inventory, items: [{ ...inventory.items[0], equipped: 'yes' }] },
      { ...inventory, items: [{ ...inventory.items[0], requiredValue: -1 }] },
      { ...inventory, rankedWins: Infinity },
    ];
    for (const value of invalid) {
      expect(isCosmeticInventory(value)).toBe(false);
      const html = renderToStaticMarkup(<CosmeticInventoryResult value={value} onEquip={() => { }}/>);
      expect(html).toContain('role="alert"');
      expect(html).toContain('아이템 정보 형식이 올바르지 않습니다');
      expect(html).not.toContain('arena-cosmetics-grid');
      expect(html).not.toContain('장착하기');
    }
    const valid = renderToStaticMarkup(<CosmeticInventoryResult value={inventory} onEquip={() => { }}/>);
    expect(valid).toContain('현재 장착');
    expect(valid).toContain('기본 알');
    expect(valid).not.toContain('아이템 정보 형식이 올바르지 않습니다');
  });

  it('uses a static allowlist with correct-slot starter fallback, never a dynamic asset URL', () => {
    expect(safeCosmeticCode('piece-forest', 'piece')).toBe('piece-forest');
    expect(safeCosmeticCode('avatar-orbit', 'avatar')).toBe('avatar-orbit');
    expect(safeCosmeticCode('avatar-orbit', 'piece')).toBe('piece-classic');
    expect(safeCosmeticCode('unknown/../../secret', 'avatar')).toBe('avatar-classic');
    const html = renderToStaticMarkup(<CosmeticPreview code="unknown/../../secret" slot="avatar"/>);
    expect(html).toContain('기본 캐릭터 미리보기');
    expect(html).toContain('arena-cosmetic-art--avatar-classic');
    expect(html).not.toContain('secret');
  });

  it('issues a single-field same-origin JSON PUT and rejects arbitrary codes before network access', async () => {
    const mock = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({
        data: { pieceCode: 'piece-forest', avatarCode: 'avatar-classic' },
      }),
    }));
    vi.stubGlobal('fetch', mock);
    expect(await equipCosmetic('piece-forest')).toEqual({
      pieceCode: 'piece-forest', avatarCode: 'avatar-classic',
    });
    expect(mock).toHaveBeenCalledWith('/api/cosmetics/equip',
      expect.objectContaining({
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCode: 'piece-forest' }),
      }));
    await expect(equipCosmetic('piece-unlisted')).rejects.toMatchObject({ status: 400 });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('maps 401/403/409/503 into safe user messages without leaking server internals', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 409, json: async () => ({ error: 'COSMETIC_LOCKED', secret: 'DB_TOKEN' }),
    })));
    await expect(cosmeticRequest('/api/cosmetics/me')).rejects.toMatchObject({
      status: 409, code: 'COSMETIC_LOCKED',
    });
    expect(cosmeticErrorText(new CosmeticRequestError(401, 'AUTH_REQUIRED'))).toContain('로그인');
    expect(cosmeticErrorText(new CosmeticRequestError(403, 'ORIGIN_NOT_ALLOWED'))).toContain('출처');
    expect(cosmeticErrorText(new CosmeticRequestError(409, 'COSMETIC_LOCKED'))).toContain('해금');
    expect(cosmeticErrorText(new CosmeticRequestError(503, 'private DB_TOKEN'))).not.toContain('DB_TOKEN');
  });

  it('shows loading instead of invented unlocks before data arrives', () => {
    const html = renderToStaticMarkup(<CosmeticWardrobe/>);
    expect(html).toContain('보유 아이템을 불러오고 있습니다');
    expect(html).not.toContain('기본 알');
    expect(html).not.toContain('장착하기');
  });
});
