import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {GamePieces} from '../src/components/game/game-pieces';
import {GameIdentityHeading} from '../src/components/game/game-identity-heading';
import {getPlayerIdentities, type IdentityMatch} from '../src/lib/game/player-identity';
import {type Board} from '../src/lib/game/engine';
const a='00000000-0000-0000-0000-000000000001';
const b='00000000-0000-0000-0000-000000000002';
const board:Board={pieces:[
 {id:'a-1',owner:a,x:175,y:250},
 {id:'b-1',owner:b,x:625,y:250},
]};
const match:IdentityMatch={
 player1_id:a,player2_id:b,turn_user_id:a,winner_id:null,status:'active'
};
const players=[{seat:1,nickname:'선공닉네임'},{seat:2,nickname:'후공닉네임'}];

describe('unobstructed game board identity indicators',()=>{
 it('keeps a subtle ownership text mark, without any dashed/outer ownership halo',()=>{
  const html=renderToStaticMarkup(<svg><GamePieces board={board} firstPlayerId={a} viewerId={a}/></svg>);
  expect(html).toContain('data-piece-owner="mine"');
  expect(html).toContain('data-piece-owner="opponent"');
  expect(html.match(/>나<\/text>/g)).toHaveLength(1);
  expect(html).not.toContain('stroke-dasharray');
  expect(html).not.toContain('stroke-width="2.6"');
  expect(html).toContain('stroke-width="1.5"');
 });
 it('preserves each player viewpoint in the header without occupying board coordinates',()=>{
  const first=getPlayerIdentities(match,a,players,board);
  const second=getPlayerIdentities(match,b,players,board);
  const firstHtml=renderToStaticMarkup(<GameIdentityHeading match={match} viewerId={a}
   players={first} mode="casual" animating={false} pending={false} remaining={90}/>);
  const secondHtml=renderToStaticMarkup(<GameIdentityHeading match={match} viewerId={b}
   players={second} mode="ranked" animating={false} pending={false} remaining={90}/>);
  expect(firstHtml).toContain('내 알 · 주황색 · 선공');
  expect(secondHtml).toContain('내 알 · 파란색 · 후공');
  expect(firstHtml).toContain('내 턴');
  expect(secondHtml).toContain('상대 턴');
  const gameSource=readFileSync(new URL('../src/components/game/game-board.tsx',import.meta.url),'utf8');
  expect(gameSource).toContain('<GamePieces board={board}');
  expect(gameSource).not.toContain('width="188" height="34"');
  expect(gameSource).not.toContain('identities.map(identity');
 });
});
