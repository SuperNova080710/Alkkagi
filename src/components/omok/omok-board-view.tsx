'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import './omok-board.css';

const SIZE = 15;
const AXIS = Array.from({ length: SIZE }, (_, index) => index);
export type OmokStone = 'black' | 'white';
export type OmokBoardCells = readonly (readonly (OmokStone | null)[])[];
export type OmokPosition = { row: number; col: number };
export type OmokBoardViewProps = {
  board: unknown;
  lastMove?: OmokPosition | null;
  stoneToPlace?: OmokStone;
  myTurn?: boolean;
  status?: 'waiting' | 'active' | 'finished';
  pending?: boolean;
  onPlace?: (position: OmokPosition) => void;
};

export function isOmokBoardCells(value: unknown): value is OmokBoardCells {
  return Array.isArray(value) && value.length === SIZE &&
    value.every(row => Array.isArray(row) && row.length === SIZE &&
      row.every(cell => cell === 'black' || cell === 'white' || cell === null));
}

function validPosition(position: unknown): position is OmokPosition {
  if (!position || typeof position !== 'object' || Array.isArray(position)) return false;
  const value = position as Partial<OmokPosition>;
  return Number.isInteger(value.row) && Number.isInteger(value.col) &&
    value.row! >= 0 && value.row! < SIZE && value.col! >= 0 && value.col! < SIZE;
}
function stoneName(stone: OmokStone | null): string {
  return stone === 'black' ? '흑돌' : stone === 'white' ? '백돌' : '빈 칸';
}
function clamp(index: number) {
  return Math.max(0, Math.min(SIZE - 1, index));
}

/**
 * Server-authoritative 15×15 board. Never calculates win/turn/RP or places
 * optimistic stones. Calling onPlace sends only a proposed (row,col) coordinate.
 */
export function OmokBoardView({
  board, lastMove = null, stoneToPlace = 'black', myTurn = false,
  status = 'active', pending = false, onPlace,
}: OmokBoardViewProps) {
  const [cursor, setCursor] = useState<OmokPosition>({ row: 7, col: 7 });
  const grid = useRef<HTMLDivElement>(null);
  if (!isOmokBoardCells(board)) {
    return <p role="alert" className="arena-omok-board-error">오목판 정보를 확인할 수 없습니다. 새로고침해 주세요.</p>;
  }
  const marked = validPosition(lastMove) ? lastMove : null;
  const editable = status === 'active' && myTurn && !pending && !!onPlace;
  const canPlace = (row: number, col: number) => editable && board[row][col] === null;
  const statusLabel = status === 'finished' ? '경기가 종료되었습니다.' :
    status === 'waiting' ? '대전 상대를 기다리고 있습니다.' :
    pending ? '착수를 서버에 확인하고 있습니다.' :
    myTurn ? `내 턴 · ${stoneToPlace === 'black' ? '흑돌' : '백돌'}` : '상대 턴 · 대기 중';

  function select(row: number, col: number) {
    const next = { row: clamp(row), col: clamp(col) };
    setCursor(next);
    grid.current?.querySelector<HTMLButtonElement>(
      `[data-omok-row="${next.row}"][data-omok-col="${next.col}"]`,
    )?.focus();
  }
  function onGridKey(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    let next: OmokPosition;
    switch (event.key) {
      case 'ArrowUp': next = { row: row - 1, col }; break;
      case 'ArrowDown': next = { row: row + 1, col }; break;
      case 'ArrowLeft': next = { row, col: col - 1 }; break;
      case 'ArrowRight': next = { row, col: col + 1 }; break;
      case 'Home': next = { row, col: 0 }; break;
      case 'End': next = { row, col: SIZE - 1 }; break;
      default: return;
    }
    event.preventDefault();
    select(next.row, next.col);
  }

  return <section className="arena-omok-board-view" aria-label="오목 경기판">
    <div className="arena-omok-board-heading">
      <strong>오목판 · 15×15</strong>
      <span role="status" aria-live="polite">{statusLabel}</span>
    </div>
    <div className="arena-omok-board-frame">
      <div ref={grid} className="arena-omok-board-grid" role="grid"
        aria-label="오목판, 방향키로 이동하고 Enter 또는 Space로 착수"
        aria-readonly={!editable}>
        {board.map((cells, row) => <div role="row" className="arena-omok-board-row" key={row}>
          {cells.map((stone, col) => {
            const isLast = marked?.row === row && marked.col === col;
            const hoshi = (row === 3 || row === 7 || row === 11) &&
              (col === 3 || col === 7 || col === 11);
            return <button type="button" role="gridcell" key={col}
              className="arena-omok-board-cell"
              data-omok-row={row} data-omok-col={col}
              data-omok-last={isLast ? 'true' : undefined}
              aria-label={`${row + 1}행 ${col + 1}열, ${stoneName(stone)}${isLast ? ', 마지막 착수' : ''}`}
              aria-current={isLast ? 'true' : undefined}
              aria-disabled={!canPlace(row, col)}
              tabIndex={cursor.row === row && cursor.col === col ? 0 : -1}
              onFocus={() => setCursor({ row, col })}
              onKeyDown={event => onGridKey(event, row, col)}
              onClick={() => { if (canPlace(row, col)) onPlace?.({ row, col }); }}>
              {hoshi && stone === null && <span className="arena-omok-hoshi" aria-hidden="true"/>}
              {stone && <span className={`arena-omok-stone arena-omok-stone--${stone}`}
                aria-hidden="true">{isLast && <span className="arena-omok-last-dot"/>}</span>}
            </button>;
          })}
        </div>)}
      </div>
    </div>
    <p className="arena-omok-board-instructions">방향키로 칸 이동, Enter/Space로 선택 · 좌표는 1~15행/열로 읽습니다.</p>
    {onPlace && <div className="arena-omok-coordinate-entry" aria-label="좌표로 착수">
      <label>행
        <select value={cursor.row} onChange={event => setCursor(c => ({ ...c, row: Number(event.target.value) }))}>
          {AXIS.map(index => <option value={index} key={index}>{index + 1}행</option>)}
        </select>
      </label>
      <label>열
        <select value={cursor.col} onChange={event => setCursor(c => ({ ...c, col: Number(event.target.value) }))}>
          {AXIS.map(index => <option value={index} key={index}>{index + 1}열</option>)}
        </select>
      </label>
      <button type="button" className="arena-button"
        disabled={!canPlace(cursor.row, cursor.col)}
        onClick={() => { if (canPlace(cursor.row, cursor.col)) onPlace({ ...cursor }); }}>
        {pending ? '확인 중…' : '선택한 칸에 착수'}
      </button>
    </div>}
  </section>;
}
