import { COSMETIC_STYLES, safeCosmeticCode, type CosmeticSlot } from './cosmetic-api';
import { chessPieceGlyphs } from '@/lib/chess/pieces';
import './game-skins.css';

/** Purely decorative previews; never alters game physics or hit targets. */
export function CosmeticPreview({ code, slot, compact = false }: {
  code?: string; slot: CosmeticSlot; compact?: boolean;
}) {
  const safe = safeCosmeticCode(code, slot);
  const className = 'arena-cosmetic-preview arena-cosmetic-preview--' + slot +
    (compact ? ' arena-cosmetic-preview--compact' : '');
  const label = COSMETIC_STYLES[safe].name + ' 미리보기';
  if (slot === 'omok') return <span className={className} role="img" aria-label={label + ' · 흑돌과 백돌'}>
    <span className="arena-cosmetic-omok-pair" aria-hidden="true">
      {(['black','white'] as const).map(color => <span key={color}
        className={'arena-cosmetic-omok-sample arena-omok-stone--' + color} data-omok-skin={safe}/>)}
    </span>
  </span>;
  if (slot === 'chess') return <span className={className} role="img" aria-label={label + ' · 백 기물과 흑 기물'}>
    <span className="arena-cosmetic-chess-set" aria-hidden="true">
      {(['w','b'] as const).map(color => <span className="arena-cosmetic-chess-rank" key={color}>
        {Object.values(chessPieceGlyphs).map(glyph => <span key={glyph}
          className={'arena-cosmetic-chess-sample chess-piece--' + color} data-chess-skin={safe}>{glyph}</span>)}
      </span>)}
    </span>
  </span>;
  return <span className={className} role="img" aria-label={label}>
    <span className={'arena-cosmetic-art arena-cosmetic-art--' + safe} aria-hidden="true">
      <span className="arena-cosmetic-art-sheen"/>
      {slot === 'avatar' && <span className="arena-cosmetic-face">
        <span className="arena-cosmetic-eye"/><span className="arena-cosmetic-eye"/>
      </span>}
    </span>
  </span>;
}
