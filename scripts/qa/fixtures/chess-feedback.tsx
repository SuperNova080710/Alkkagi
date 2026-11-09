import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { ChessBoard } from '../../../src/components/chess/chess-board';
import { ChessTurnStatus } from '../../../src/components/chess/chess-turn-status';
import { ChessAi } from '../../../src/components/chess/chess-ai';
import { ChessMatchClient } from '../../../src/components/chess/chess-online';
import { ArenaShell } from '../../../src/components/ui/arena';
import type { ChessSnapshot } from '../../../src/components/chess/client';

// HTTP-only local preview lacks secure-context randomUUID; only mocked requests use these IDs.
let requestNumber = 0;
if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', {value: () =>
  'aaaaaaaa-aaaa-4aaa-8aaa-' + String(++requestNumber).padStart(12,'0')});
const root = createRoot(document.getElementById('root')!);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve,ms));
const results: string[] = [];
function check(ok: unknown, message: string) {
  if (!ok) throw Error(message);
  results.push(message);
}
async function until(test: () => boolean) {
  for (let i=0; i<150; i++) {if (test()) return; await sleep(20);}
  throw Error('UI update timeout');
}
function click(square: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label^="${square} "]`);
  if (!button) throw Error('Missing square ' + square);
  flushSync(()=>button.click());
}
let position = DEFAULT_POSITION;
let black = false;
function draw() {
  const board = new Chess(position);
  flushSync(()=>root.render(<ArenaShell game="chess"><div className="chess-page chess-game-layout">
    <div className="chess-board-stage">
      <ChessTurnStatus black={black} myTurn={board.turn()===(black?'b':'w')} finished={false} inCheck={board.isCheck()}/>
      <ChessBoard fen={position} black={black} enabled onMove={move=>{board.move(move);position=board.fen();draw();}}/>
    </div><aside className="arena-panel"><h1>체스 UI 회귀 검증</h1><p>실제 기물·차례·스타일, 격리된 상태 데이터</p></aside>
  </div></ArenaShell>));
}
function inspectAnimation(expected: number) {
  const moving = [...document.querySelectorAll<HTMLElement>('.chess-piece--moving')];
  check(moving.length===expected,'movement element count '+expected);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const piece of moving) {
    const animation = piece.getAnimations()[0];
    if (reduced) check(!animation,'reduced motion disables animation');
    else {
      check(Boolean(animation),'CSS animation is running');
      animation.pause(); animation.currentTime=140;
      check(getComputedStyle(piece).transform !== 'matrix(1, 0, 0, 1, 0, 0)','piece travels between squares');
      animation.finish();
    }
  }
}
async function run() {
  draw();
  const rect = document.querySelector('.chess-board')!.getBoundingClientRect();
  const available = document.querySelector('.chess-board-stage')!.clientWidth;
  check(rect.width >= Math.min(352,available)-1,'board retains usable width: '+rect.width.toFixed(1));
  check(Math.abs(rect.width-rect.height)<1,'board is square');
  check(document.documentElement.scrollWidth<=innerWidth+1,'no document horizontal overflow');
  const isShort = innerHeight<=400;
  if (isShort) check(document.documentElement.scrollHeight>innerHeight,'short viewport scrolls without shrinking controls');
  click('e2');click('e4');inspectAnimation(1);
  const piece = document.querySelector('.chess-piece--moving');draw();
  check(document.querySelector('.chess-piece--moving')===piece,'duplicate snapshot preserves piece identity');
  check(!piece!.getAnimations().some(a=>a.playState==='running'),'duplicate snapshot does not replay');
  black=true;position=DEFAULT_POSITION;draw();click('e2');click('e4');inspectAnimation(1);
  check((document.querySelector('.chess-piece--moving') as HTMLElement).style.getPropertyValue('--chess-move-y')==='-200%','black orientation movement direction');
  black=false;position='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';draw();click('e1');click('g1');inspectAnimation(2);
  position='4k3/P7/8/8/8/8/8/4K3 w - - 0 1';draw();click('a7');click('a8');
  check(Boolean(document.querySelector('.chess-promotion')),'promotion choice opens');
  const knight = [...document.querySelectorAll<HTMLButtonElement>('.chess-promotion button')].find(b=>b.textContent==='나이트')!;
  flushSync(()=>knight.click());inspectAnimation(1);
  check(Boolean(document.querySelector('button[aria-label^="a8 백 나이트"]')),'underpromotion updates destination piece');
  position='4k3/8/8/8/8/8/4r3/4K3 w - - 0 1';draw();
  check(Boolean(document.querySelector('[data-check="true"]')),'checked king is highlighted');
  position=DEFAULT_POSITION;draw();
  check(!document.querySelector('.chess-piece--moving'),'discontinuous snapshot does not animate');

  // Run the actual match component and snapshot hook with controlled HTTP responses.
  let snapshot: ChessSnapshot = {id:'qa',whiteId:'me',blackId:'other',turnUserId:'me',status:'active',
    fen:DEFAULT_POSITION,inCheck:false,ply:0,winnerId:null,finishReason:null,moves:[],mode:'casual'};
  let failPost = true;
  let failGet = false;
  window.fetch = async (_input,options) => {
    await sleep(80);
    if (options?.method==='POST') {
      if (failPost) {failGet=true; throw Error('테스트 착수 응답 유실');}
      const game=new Chess(snapshot.fen); game.move(JSON.parse(options.body as string));
      snapshot={...snapshot,fen:game.fen(),ply:1,turnUserId:'other',moves:[{ply:1,san:'e4'}]};
    } else if (failGet) throw Error('테스트 재동기화 실패');
    return Response.json({data:snapshot});
  };
  for (const mode of ['casual','ranked'] as const) {
    snapshot={...snapshot,mode};failPost=true;
    flushSync(()=>root.render(<ArenaShell game="chess"><div className="chess-page"><ChessMatchClient key={mode} matchId="qa" userId="me"/></div></ArenaShell>));
    await until(()=>document.querySelector('.chess-turn-status')?.getAttribute('data-state')==='mine');
    click('e2');click('e4');
    await until(()=>Boolean(document.querySelector('[role="alert"]')?.textContent?.includes('재동기화 실패')));
    check(document.querySelector('.chess-turn-status')?.getAttribute('data-state')==='error',mode+' POST/GET failures show error banner');
    check(document.querySelectorAll('.chess-square[aria-disabled="true"]').length===64,mode+' input stays blocked while offline');
    failGet=false; window.dispatchEvent(new Event('online'));
    await until(()=>document.querySelector('.chess-turn-status')?.getAttribute('data-state')==='mine');
    check(!document.querySelector('[role="alert"]'),mode+' authoritative GET clears stale alert');
  }
  failPost=false;click('e2');click('e4');
  await until(()=>document.querySelector('.chess-turn-status')?.getAttribute('data-state')==='opponent');
  inspectAnimation(1);

  localStorage.removeItem('chess-practice-v040:qa-' + innerWidth);location.hash='easy';
  flushSync(()=>root.render(<ArenaShell game="chess"><div className="chess-page"><ChessAi userId={'qa-' + innerWidth}/></div></ArenaShell>));
  await until(()=>Boolean(document.querySelector('.chess-board')));click('e2');click('e4');
  check(document.querySelector('.chess-turn-status')?.getAttribute('data-state')==='opponent','AI thinking state');
  await until(()=>document.querySelector('.chess-turn-status')?.getAttribute('data-state')==='mine');
  inspectAnimation(1);
  document.documentElement.dataset.qaResult=JSON.stringify({passed:true,width:innerWidth,height:innerHeight,boardWidth:rect.width,checks:results});
  const output=document.createElement('pre');output.id='qa-result';output.textContent='PASS '+results.length+' checks · '+innerWidth+'×'+innerHeight+' · board '+rect.width+'px';document.body.prepend(output);
}
run().catch(error=>{
  document.documentElement.dataset.qaResult=JSON.stringify({passed:false,width:innerWidth,height:innerHeight,error:String(error),checks:results});
  const output=document.createElement('pre');output.id='qa-result';output.textContent='FAIL '+String(error);document.body.prepend(output);
});
