import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameIdentityHeading } from '../src/components/game/game-identity-heading';
import { getPlayerIdentities, getTurnMessage, type IdentityMatch } from '../src/lib/game/player-identity';
import { type Board } from '../src/lib/game/engine';

const a='00000000-0000-0000-0000-000000000001';
const b='00000000-0000-0000-0000-000000000002';
const players=[{seat:1,nickname:'A플레이어'},{seat:2,nickname:'B플레이어'}];
const board:Board={pieces:[
 {id:'a1',owner:a,x:175,y:250},{id:'a2',owner:a,x:175,y:300},
 {id:'b1',owner:b,x:625,y:250},
]};
const match:IdentityMatch={player1_id:a,player2_id:b,turn_user_id:a,winner_id:null,status:'active'};

describe('game player and turn identity',()=>{
 it('shows orange-left as mine to player A and blue-right as mine to player B',()=>{
  const first=getPlayerIdentities(match,a,players,board);
  const second=getPlayerIdentities(match,b,players,board);
  expect(first[0]).toMatchObject({isMe:true,seat:1,colorName:'주황색',startSide:'왼쪽',remaining:2,isTurn:true});
  expect(second[1]).toMatchObject({isMe:true,seat:2,colorName:'파란색',startSide:'오른쪽',remaining:1,isTurn:false});
  expect(second[0].isMe).toBe(false);
 });
 it('tells each player whose turn it is using their perspective',()=>{
  const first=getPlayerIdentities(match,a,players,board);
  const second=getPlayerIdentities(match,b,players,board);
  expect(getTurnMessage(match,a,first,{animating:false,pending:false,remaining:99})).toContain('내 턴!');
  expect(getTurnMessage(match,b,second,{animating:false,pending:false,remaining:99})).toContain('상대 턴');
  expect(getTurnMessage({...match,turn_user_id:b},b,second,{animating:false,pending:false,remaining:99})).toContain('내 턴!');
 });
 it('distinguishes movement, server response, expired turn and game over',()=>{
  const data=getPlayerIdentities(match,a,players,board);
  expect(getTurnMessage(match,a,data,{animating:true,pending:false,remaining:30})).toContain('다음 차례');
  expect(getTurnMessage(match,a,data,{animating:false,pending:true,remaining:30})).toContain('발사 처리 중');
  expect(getTurnMessage(match,a,data,{animating:false,pending:false,remaining:0})).toContain('제한 시간 종료');
  expect(getTurnMessage({...match,status:'finished',winner_id:a},a,data,{animating:false,pending:false,remaining:null})).toContain('내가 승리');
 });
 it('renders readable roles/nicknames and exactly one visible current turn badge',()=>{
  const identity=getPlayerIdentities(match,b,players,board);
  const html=renderToStaticMarkup(<GameIdentityHeading match={match} viewerId={b}
   players={identity} mode="ranked" animating={false} pending={false} remaining={80}/>);
  expect(html).toContain('나 · 후공 · 파란색');
  expect(html).toContain('상대 · 선공 · 주황색');
  expect(html).toContain('상대 턴');
  expect(html).toContain('A플레이어');
  expect(html).toContain('B플레이어');
  expect(html.split('>현재 턴</span>').length - 1).toBe(1);
  expect(html).toContain('aria-live="polite"');
 });
});
