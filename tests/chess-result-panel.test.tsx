// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_POSITION } from 'chess.js';
import { ChessMatchClient } from '../src/components/chess/chess-online';
import { ChessAi } from '../src/components/chess/chess-ai';
import type { ChessSnapshot } from '../src/components/chess/client';

const {push} = vi.hoisted(() => ({push:vi.fn()}));
vi.mock('next/navigation', () => ({useRouter: () => ({push,replace:vi.fn()})}));
vi.mock('next/link', () => ({default: ({children, href}: {children:React.ReactNode; href:string}) => <a href={href}>{children}</a>}));
const active: ChessSnapshot = {
  id:'result-test',whiteId:'me',blackId:'other',turnUserId:'me',status:'active',fen:DEFAULT_POSITION,
  inCheck:false,ply:0,winnerId:null,finishReason:null,moves:[],mode:'casual',
};
const response = (data: ChessSnapshot) => Response.json({data});
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  push.mockClear();
});
afterEach(async () => {
  await act(async () => {root.unmount();});
  container.remove();vi.unstubAllGlobals();
  localStorage.removeItem('chess-practice-v040:result-test');
});
const overlay = () => container.querySelector('[aria-label="체스 경기 결과"]');
const button = (label: string) => [...container.querySelectorAll('button')].find(node => node.textContent===label)!;

describe('v0.4.1 online chess result panel', () => {
  it.each(['casual','ranked'] as const)('%s shows confirmed results after snapshot update and returns to its lobby', async mode => {
    const finished: ChessSnapshot={...active,mode,status:'finished',turnUserId:null,winnerId:'me',finishReason:'checkmate'};
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({...active,mode})).mockResolvedValue(response(finished)));
    await act(async () => {root.render(<ChessMatchClient matchId="result-test" userId="me"/>);});
    expect(overlay()).toBeNull();
    await act(async () => {window.dispatchEvent(new Event('online'));});
    expect(overlay()?.textContent).toContain('MATCH RESULT');
    expect(overlay()?.querySelector('h3')?.textContent).toBe('승리');
    expect(overlay()?.textContent).toContain('종료 사유 · 체크메이트');
    expect(container.querySelectorAll('.chess-square[aria-disabled="true"]')).toHaveLength(64);
    expect(document.activeElement).toBe(overlay()?.querySelector('.game-result-card'));
    expect(overlay()?.querySelector('[aria-label="재대결 신청"]')).toBeNull();
    expect(overlay()?.textContent).not.toContain('양쪽 모두 수락');
    if(mode==='ranked')expect(overlay()?.textContent).toContain('체스 RP 정산');
    await act(async () => {button('로비로 돌아가기').click();});
    expect(push).toHaveBeenCalledWith(mode==='ranked'?'/chess/ranked':'/chess');
  });

  it.each([
    ['me','checkmate','승리','체크메이트'],
    ['other','resignation','패배','기권'],
    ['other','timeout','패배','시간 초과'],
    [null,'stalemate','무승부','스테일메이트'],
    [null,'insufficient-material','무승부','기물 부족'],
    [null,'threefold-repetition','무승부','3회 반복'],
    [null,'fifty-move-rule','무승부','50수 규칙'],
    [null,'unknown','무승부','대국 종료'],
  ])('restores a finished game (%s, %s) without inventing a local result', async (winnerId,finishReason,outcome,label) => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...active,status:'finished',turnUserId:null,winnerId,finishReason})));
    await act(async () => {root.render(<ChessMatchClient matchId="result-test" userId="me"/>);});
    expect(overlay()?.querySelector('h3')?.textContent).toBe(outcome);
    expect(overlay()?.textContent).toContain('종료 사유 · '+label);
  });

  it('uses the same player identity when the current user is black', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...active,status:'finished',turnUserId:null,
      whiteId:'other',blackId:'me',winnerId:'me',finishReason:'timeout'})));
    await act(async () => {root.render(<ChessMatchClient matchId="result-test" userId="me"/>);});
    expect(overlay()?.querySelector('h3')?.textContent).toBe('승리');
  });

  it('does not show a result on an active game connection failure', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(active)).mockRejectedValue(Error('연결 실패')));
    await act(async () => {root.render(<ChessMatchClient matchId="result-test" userId="me"/>);});
    await act(async () => {window.dispatchEvent(new Event('online'));});
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('연결 실패');
    expect(overlay()).toBeNull();
  });

  it('keeps the confirmed panel visible after a later refresh failure, without duplicate alerts', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({...active,status:'finished',winnerId:'me',finishReason:'checkmate'}))
      .mockRejectedValue(Error('연결 실패')));
    await act(async () => {root.render(<ChessMatchClient matchId="result-test" userId="me"/>);});
    await act(async () => {window.dispatchEvent(new Event('online'));});
    expect(overlay()?.querySelector('h3')?.textContent).toBe('승리');
    expect(overlay()?.querySelector('[role="alert"]')?.textContent).toBe('연결 실패');
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
});

describe('existing chess AI result panel', () => {
  it('shows the same result surface and difficulty replay choice after resignation', async () => {
    window.history.replaceState(null,'','/#easy');
    await act(async () => {root.render(<ChessAi userId="result-test"/>);});
    expect(overlay()).toBeNull();
    await act(async () => {button('기권').click();});
    expect(overlay()?.querySelector('h3')?.textContent).toBe('패배');
    expect(overlay()?.textContent).toContain('종료 사유 · 기권');
    expect(overlay()?.textContent).toContain('다시하기 · 난이도 선택');
    await act(async () => {button('로비로 돌아가기').click();});
    expect(push).toHaveBeenCalledWith('/chess');
  });
});
