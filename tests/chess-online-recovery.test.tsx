// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { ChessMatchClient } from '../src/components/chess/chess-online';
vi.mock('../src/components/chess/chess-match-chat', () => ({ChessMatchChat: () => null}));
import type { ChessSnapshot } from '../src/components/chess/client';

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}));
vi.mock('next/link', () => ({default: ({children, href}: {children: React.ReactNode; href: string}) => <a href={href}>{children}</a>}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
const initial: ChessSnapshot = {
  id:'test-match',whiteId:'me',blackId:'other',turnUserId:'me',status:'active',
  fen:DEFAULT_POSITION,inCheck:false,ply:0,winnerId:null,finishReason:null,moves:[],mode:'casual',
};
const response = (data: ChessSnapshot) => Response.json({data});
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {root.unmount();});
  container.remove();
  vi.unstubAllGlobals();
});
async function clickSquare(square: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label^="${square} "]`);
  expect(button).not.toBeNull();
  await act(async () => {button!.click();});
}
const bannerState = () => container.querySelector('.chess-turn-status')?.getAttribute('data-state');
const disabledSquares = () => container.querySelectorAll('.chess-square[aria-disabled="true"]').length;

describe('chess POST failure and authoritative GET recovery', () => {
  it.each(['casual','ranked'] as const)('keeps banner and alert synchronized through %s recovery', async mode => {
    const post = deferred<Response>();
    const get = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(response({...initial,mode}))
      .mockImplementationOnce(() => post.promise).mockImplementationOnce(() => get.promise);
    vi.stubGlobal('fetch',fetcher);
    await act(async () => {root.render(<ChessMatchClient matchId="test-match" userId="me"/>);});
    expect(bannerState()).toBe('mine');
    await clickSquare('e2'); await clickSquare('e4');
    expect(bannerState()).toBe('pending');
    expect(disabledSquares()).toBe(64);
    await act(async () => {post.reject(Error('착수 응답 유실'));});
    expect(bannerState()).toBe('error');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('착수 응답 유실');
    expect(disabledSquares()).toBe(64);
    // The POST may have reached the server despite the lost response.
    const game = new Chess(); game.move('e4');
    await act(async () => {get.resolve(response({...initial,mode,fen:game.fen(),ply:1,
      turnUserId:'other',moves:[{ply:1,san:'e4'}]}));});
    expect(bannerState()).toBe('opponent');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(disabledSquares()).toBe(64);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('unlocks the unchanged turn only after a confirmed snapshot', async () => {
    const get = deferred<Response>();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(initial))
      .mockRejectedValueOnce(Error('착수 실패')).mockImplementationOnce(() => get.promise));
    await act(async () => {root.render(<ChessMatchClient matchId="test-match" userId="me"/>);});
    await clickSquare('e2'); await clickSquare('e4');
    expect(bannerState()).toBe('error');
    await act(async () => {get.resolve(response(initial));});
    expect(bannerState()).toBe('mine');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(disabledSquares()).toBe(0);
  });

  it('keeps input blocked after both requests fail and clears on later reconnection', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(initial))
      .mockRejectedValueOnce(Error('착수 실패')).mockRejectedValueOnce(Error('동기화 실패'))
      .mockResolvedValue(response(initial));
    vi.stubGlobal('fetch',fetcher);
    await act(async () => {root.render(<ChessMatchClient matchId="test-match" userId="me"/>);});
    await clickSquare('e2'); await clickSquare('e4');
    expect(bannerState()).toBe('error');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('동기화 실패');
    expect(disabledSquares()).toBe(64);
    await clickSquare('e2'); await clickSquare('e4');
    expect(fetcher).toHaveBeenCalledTimes(3);
    await act(async () => {window.dispatchEvent(new Event('online'));});
    expect(bannerState()).toBe('mine');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(disabledSquares()).toBe(0);
  });
});
