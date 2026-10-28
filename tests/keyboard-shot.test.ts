import {describe,expect,it} from 'vitest';
import {DIRECTIONS,keyboardVector} from '../src/lib/game/keyboard-shot';
import {MAX_FORCE,MIN_FORCE} from '../src/lib/game/engine';
describe('keyboard-only shot input',()=>{
 it('supports eight directions with server-valid power',()=>{
  expect(DIRECTIONS).toHaveLength(8);
  for(const direction of DIRECTIONS){
   const vector=keyboardVector(direction.value,65);
   expect(Math.hypot(vector.dx,vector.dy)).toBeCloseTo(65,9);
  }
 });
 it('points right, left and up correctly',()=>{
  expect(keyboardVector('right',65).dx).toBe(65);
  expect(keyboardVector('left',65).dx).toBeCloseTo(-65,9);
  expect(keyboardVector('up',65).dy).toBeCloseTo(-65,9);
 });
 it('prevents invalid force values',()=>{
  expect(()=>keyboardVector('right',MIN_FORCE-1)).toThrow('INVALID_KEYBOARD_SHOT');
  expect(()=>keyboardVector('right',MAX_FORCE+1)).toThrow('INVALID_KEYBOARD_SHOT');
  expect(()=>keyboardVector('right',Number.NaN)).toThrow('INVALID_KEYBOARD_SHOT');
 });
});