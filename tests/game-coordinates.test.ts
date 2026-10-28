import { describe, expect, it } from 'vitest';
import { viewportToBoard } from '../src/lib/game/coordinates';

describe('responsive SVG pointer mapping', () => {
  it('maps a precisely fitted court to the middle of an 800x500 board', () => {
    expect(viewportToBoard(400, 250, { left: 0, top: 0, width: 800, height: 500 }))
      .toEqual({ x: 400, y: 250 });
  });

  it('subtracts horizontal letterboxing on a wide desktop stage', () => {
    // 1000x500 stage: actual 800x500 board is centered with 100px side gaps.
    expect(viewportToBoard(100, 0, { left: 0, top: 0, width: 1000, height: 500 }))
      .toEqual({ x: 0, y: 0 });
    expect(viewportToBoard(900, 500, { left: 0, top: 0, width: 1000, height: 500 }))
      .toEqual({ x: 800, y: 500 });
  });

  it('subtracts vertical letterboxing and accounts for page offset', () => {
    // 800x800 stage: top and bottom are padded by 150px.
    expect(viewportToBoard(410, 360, { left: 10, top: -40, width: 800, height: 800 }))
      .toEqual({ x: 400, y: 250 });
  });

  it('works when the board shrinks and never maps a gap to a legal piece', () => {
    const rect = { left: 40, top: 50, width: 400, height: 400 };
    expect(viewportToBoard(240, 250, rect)).toEqual({ x: 400, y: 250 });
    expect(viewportToBoard(240, 60, rect)?.y).toBeLessThan(0);
  });

  it('refuses invalid geometry', () => {
    expect(viewportToBoard(10, 20, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
    expect(viewportToBoard(NaN, 20, { left: 0, top: 0, width: 800, height: 500 })).toBeNull();
  });
});
