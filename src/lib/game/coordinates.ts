import { HEIGHT, WIDTH } from './engine';

/** Map a pointer on the SVG element to its viewBox, including letterboxing. */
export function viewportToBoard(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): { x: number; y: number } | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) ||
      rect.width <= 0 || rect.height <= 0) return null;

  // SVG preserveAspectRatio defaults to xMidYMid meet: either axis may be letterboxed.
  const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  const left = rect.left + (rect.width - WIDTH * scale) / 2;
  const top = rect.top + (rect.height - HEIGHT * scale) / 2;
  return { x: (clientX - left) / scale, y: (clientY - top) / scale };
}
