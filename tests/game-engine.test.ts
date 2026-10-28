import {describe,it,expect} from 'vitest';
import {outcome,simulateShot,validBoard,type Board} from '../src/lib/game/engine';
const a='00000000-0000-0000-0000-000000000001';
const b='00000000-0000-0000-0000-000000000002';
const base:Board={pieces:[{id:'a1',owner:a,x:100,y:250},{id:'b1',owner:b,x:650,y:250}]};
describe('authoritative deterministic physics',()=>{
 it('rejects malformed input, other player pieces and excessive power',()=>{
  expect(validBoard(base)).toBe(true);
  expect(validBoard({pieces:[{id:'x',owner:a,x:Infinity,y:20}]})).toBe(false);
  expect(()=>simulateShot(base,a,{pieceId:'b1',dx:50,dy:0})).toThrow('NOT_YOUR_PIECE');
  expect(()=>simulateShot(base,a,{pieceId:'a1',dx:200,dy:0})).toThrow('INVALID_FORCE');
  expect(()=>simulateShot(base,a,{pieceId:'a1',dx:NaN,dy:0})).toThrow('INVALID_SHOT');
 });
 it('is deterministic and does not modify the original snapshot',()=>{
  const copy=JSON.stringify(base),shot={pieceId:'a1',dx:80,dy:0};
  const one=simulateShot(base,a,shot),two=simulateShot(base,a,shot);
  expect(one).toEqual(two);
  expect(JSON.stringify(base)).toBe(copy);
  expect(one.pieces).toHaveLength(2);
 });
 it('removes pieces that leave the board and declares the winner',()=>{
  const edge:Board={pieces:[{id:'a1',owner:a,x:30,y:250},{id:'b1',owner:b,x:500,y:250}]};
  const shot=simulateShot(edge,a,{pieceId:'a1',dx:-65,dy:0});
  expect(shot.pieces.some(p=>p.id==='a1')).toBe(false);
  expect(outcome(shot,a,b)).toEqual({finished:true,winnerId:b});
 });
 it('detects draw when both players have no pieces',()=>{
  expect(outcome({pieces:[]},a,b)).toEqual({finished:true,winnerId:null});
 });
});
