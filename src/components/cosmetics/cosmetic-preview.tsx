import { COSMETIC_STYLES, safeCosmeticCode, type CosmeticSlot } from './cosmetic-api';

/** Purely decorative previews; never alters game physics or hit targets. */
export function CosmeticPreview({ code, slot, compact = false }: {
  code: string; slot: CosmeticSlot; compact?: boolean;
}) {
  const safe = safeCosmeticCode(code, slot);
  return <span className={'arena-cosmetic-preview arena-cosmetic-preview--' + slot +
    (compact ? ' arena-cosmetic-preview--compact' : '')}
    role="img" aria-label={COSMETIC_STYLES[safe].name + ' 미리보기'}>
    <span className={'arena-cosmetic-art arena-cosmetic-art--' + safe} aria-hidden="true">
      <span className="arena-cosmetic-art-sheen"/>
      {slot === 'avatar' && <span className="arena-cosmetic-face">
        <span className="arena-cosmetic-eye"/><span className="arena-cosmetic-eye"/>
      </span>}
    </span>
  </span>;
}
