export type CosmeticSlot = 'piece' | 'avatar';
export type CosmeticItem = {
  code: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  unlockKind: 'starter' | 'ranked_wins' | 'xp_level';
  requiredValue: number;
  owned: boolean;
  equipped: boolean;
  unlockedAt: string | null;
};
export type CosmeticLoadout = { pieceCode: string; avatarCode: string };
export type CosmeticInventory = {
  loadout: CosmeticLoadout;
  items: CosmeticItem[];
  rankedWins: number;
  level: number;
};

export const COSMETIC_STYLES = {
  'piece-classic': { slot: 'piece', name: '기본 알' },
  'piece-forest': { slot: 'piece', name: '숲빛 알' },
  'piece-starlight': { slot: 'piece', name: '별빛 알' },
  'avatar-classic': { slot: 'avatar', name: '기본 캐릭터' },
  'avatar-bronze': { slot: 'avatar', name: '청동 캐릭터' },
  'avatar-orbit': { slot: 'avatar', name: '궤도 캐릭터' },
} as const;

export function safeCosmeticCode(code: string, slot: CosmeticSlot): keyof typeof COSMETIC_STYLES {
  const fallback = slot === 'piece' ? 'piece-classic' : 'avatar-classic';
  if (!Object.prototype.hasOwnProperty.call(COSMETIC_STYLES, code)) return fallback;
  const item = COSMETIC_STYLES[code as keyof typeof COSMETIC_STYLES];
  return item.slot === slot ? code as keyof typeof COSMETIC_STYLES : fallback;
}

export function cosmeticUnlockLabel(item: CosmeticItem, rankedWins: number, level: number): string {
  switch (item.unlockKind) {
    case 'starter': return '기본 제공';
    case 'ranked_wins':
      return '랭크 ' + item.requiredValue + '승 필요 · 현재 ' + rankedWins + '승';
    case 'xp_level':
      return '레벨 ' + item.requiredValue + ' 필요 · 현재 Lv.' + level;
    default: return '해금 조건 확인 필요';
  }
}

export class CosmeticRequestError extends Error {
  constructor(public status: number, public code: string) { super('Cosmetic request failed'); }
}

export function cosmeticErrorText(reason: unknown): string {
  if (!(reason instanceof CosmeticRequestError)) return '꾸미기 정보를 불러오지 못했습니다. 다시 시도해 주세요.';
  const known: Record<string, string> = {
    AUTH_REQUIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    ORIGIN_NOT_ALLOWED: '요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.',
    INVALID_COSMETIC_ITEM: '장착할 아이템을 확인할 수 없습니다.',
    COSMETIC_LOCKED: '아직 해금되지 않은 아이템입니다. 달성 조건을 확인해 주세요.',
    COSMETIC_NOT_AVAILABLE: '지금은 사용할 수 없는 아이템입니다.',
    PROFILE_NOT_FOUND: '프로필을 확인할 수 없습니다.',
    COSMETIC_SERVICE_UNAVAILABLE: '꾸미기 기능 준비 중입니다. 운영 환경을 확인해 주세요.',
  };
  if (Object.prototype.hasOwnProperty.call(known, reason.code)) return known[reason.code];
  if (reason.status === 401) return known.AUTH_REQUIRED;
  if (reason.status === 503) return known.COSMETIC_SERVICE_UNAVAILABLE;
  return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}

export async function cosmeticRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin', cache: 'no-store', ...options,
  });
  const value = await response.json().catch(() => null) as { data?: T; error?: unknown } | null;
  if (!response.ok) {
    throw new CosmeticRequestError(response.status,
      typeof value?.error === 'string' ? value.error : 'UNKNOWN');
  }
  if (!value || !Object.prototype.hasOwnProperty.call(value, 'data')) {
    throw new CosmeticRequestError(503, 'COSMETIC_SERVICE_UNAVAILABLE');
  }
  return value.data as T;
}

export function equipCosmetic(itemCode: string): Promise<CosmeticLoadout> {
  if (!Object.prototype.hasOwnProperty.call(COSMETIC_STYLES, itemCode)) {
    return Promise.reject(new CosmeticRequestError(400, 'INVALID_COSMETIC_ITEM'));
  }
  return cosmeticRequest<CosmeticLoadout>('/api/cosmetics/equip', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemCode }),
  });
}
