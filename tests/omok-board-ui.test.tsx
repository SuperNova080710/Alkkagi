import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  OmokBoardView, isOmokBoardCells,
} from '../src/components/omok/omok-board-view';

function empty(): (null | 'black' | 'white')[][] {
  return Array.from({ length: 15 }, () => Array<'black' | 'white' | null>(15).fill(null));
}
function html(board: unknown, props: Partial<Parameters<typeof OmokBoardView>[0]> = {}) {
  return renderToStaticMarkup(<OmokBoardView board={board} {...props}/>);
}

describe('v0.3 Omok 15×15 UI foundation (#237)', () => {
  it('renders 225 cells in 15 rows with one keyboard tab stop', () => {
    const markup = html(empty());
    expect(markup.match(/role="row"/g)).toHaveLength(15);
    expect(markup.match(/role="gridcell"/g)).toHaveLength(225);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(224);
    expect(markup).toContain('aria-label="오목판, 방향키로 이동하고 Enter 또는 Space로 착수"');
    expect(markup).toContain('1행 1열, 빈 칸');
    expect(markup).toContain('15행 15열, 빈 칸');
    expect(markup).toContain('상대 턴 · 대기 중');
  });

  it('validates every nested row and cell before it is rendered', () => {
    expect(isOmokBoardCells(empty())).toBe(true);
    expect(isOmokBoardCells([])).toBe(false);
    expect(isOmokBoardCells(Array(15).fill(null))).toBe(false);
    const long = empty(); long[0].push(null);
    expect(isOmokBoardCells(long)).toBe(false);
    const bad = empty() as unknown[][];
    bad[8][8] = { stone: 'black' };
    expect(isOmokBoardCells(bad)).toBe(false);
    const markup = html(bad);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('오목판 정보를 확인할 수 없습니다');
    expect(markup).not.toContain('role="gridcell"');
  });

  it('marks black and white stones distinctly and highlights the last move', () => {
    const board = empty();
    board[7][7] = 'black'; board[7][8] = 'white';
    const markup = html(board, { lastMove: { row: 7, col: 8 } });
    expect(markup).toContain('8행 8열, 흑돌');
    expect(markup).toContain('8행 9열, 백돌, 마지막 착수');
    expect(markup.match(/arena-omok-stone--black/g)).toHaveLength(1);
    expect(markup.match(/arena-omok-stone--white/g)).toHaveLength(1);
    expect(markup.match(/arena-omok-last-dot/g)).toHaveLength(1);
    expect(markup).toContain('data-omok-last="true"');
    expect(markup).toContain('aria-current="true"');
    expect(markup).not.toContain('aria-selected="true"');
  });

  it('is read-only without a server action or when not the active player', () => {
    const board = empty();
    const readonly = html(board);
    expect(readonly.match(/aria-disabled="true"/g)).toHaveLength(225);
    expect(readonly).not.toContain('좌표로 착수');
    const guest = html(board, { myTurn: false, onPlace: () => {} });
    expect(guest.match(/aria-disabled="true"/g)).toHaveLength(225);
    expect(guest).toContain('좌표로 착수');
  });

  it('allows proposal only on the active player’s empty cells; occupied cells are blocked', () => {
    const board = empty();
    board[7][7] = 'black';
    const markup = html(board, { myTurn: true, stoneToPlace: 'white', onPlace: () => {} });
    expect(markup).toContain('내 턴 · 백돌');
    expect(markup.match(/aria-disabled="false"/g)).toHaveLength(224);
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(1);
    expect(markup).toContain('7행');
    expect(markup).toContain('15열');
    expect(markup).toContain('선택한 칸에 착수');
    const pending = html(board, { myTurn: true, pending: true, onPlace: () => {} });
    expect(pending.match(/aria-disabled="true"/g)).toHaveLength(225);
    expect(pending).toContain('착수를 서버에 확인하고 있습니다');
    const finished = html(board, { myTurn: true, status: 'finished', onPlace: () => {} });
    expect(finished).toContain('경기가 종료되었습니다');
    expect(finished.match(/aria-disabled="true"/g)).toHaveLength(225);
  });

  it('ignores out-of-range last move and does not leak malformed coordinates', () => {
    const invalid = html(empty(), { lastMove: { row: -1, col: 15 } });
    expect(invalid).not.toContain('arena-omok-last-dot');
    expect(invalid).not.toContain('data-omok-last="true"');
    expect(isOmokBoardCells(null)).toBe(false);
    expect(isOmokBoardCells([{}])).toBe(false);
  });

  it('has arrow/Home/End roving focus and 44px alternative accessible input', () => {
    const source = readFileSync(new URL('../src/components/omok/omok-board-view.tsx', import.meta.url), 'utf8');
    for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End']) {
      expect(source).toContain("case '" + key + "'");
    }
    expect(source).toContain('event.preventDefault()');
    expect(source).toContain('tabIndex={cursor.row === row && cursor.col === col ? 0 : -1}');
    expect(source).toContain('onClick={() => { if (canPlace(row, col))');
    expect(source).not.toContain('playOmokMove(');
    const css = readFileSync(new URL('../src/components/omok/omok-board.css', import.meta.url), 'utf8');
    const section = css.slice(css.indexOf('/* #237: isolated'));
    expect(source).toContain("import './omok-board.css'");
    expect(source).toContain("aria-current={isLast ? 'true' : undefined}");
    expect(source).not.toContain('aria-selected={isLast}');
    expect(section).toContain('aspect-ratio: 1');
    expect(section).toContain('repeat(15, minmax(0, 1fr))');
    expect(section).toContain('min-height: 44px');
    expect(section).toContain('max-width: 480px');
    expect(section).toContain('.arena-omok-stone--white');
    expect(section).toContain('.arena-omok-stone--black');
    expect(section).not.toContain('.game-screen');
  });
});
