import {describe,expect,it} from 'vitest';
import {chooseAiShot,AI_BOT_ID,isAiDifficulty} from '../src/lib/ai/bot';
import {MAX_FORCE,MIN_FORCE,simulateShot,type Board} from '../src/lib/game/engine';
const human='00000000-0000-0000-0000-000000000011';
const board:Board={pieces:[
 ...Array.from({length:5},(_,i)=>({id:'a'+(i+1),owner:human,x:175,y:130+i*60})),
 ...Array.from({length:5},(_,i)=>({id:'b'+(i+1),owner:AI_BOT_ID,x:625,y:130+i*60})),
]};
describe('deterministic difficulty-based physics AI',()=>{
 it('allows only three stated difficulty levels',()=>{
  expect(['easy','normal','hard'].every(isAiDifficulty)).toBe(true);
  expect(isAiDifficulty('expert')).toBe(false);
 });
 for(const difficulty of ['easy','normal','hard'] as const){
  it('selects a bounded shot for '+difficulty,()=>{
   const snapshot=JSON.stringify(board);
   const shot=chooseAiShot(board,human,difficulty,1);
   expect(shot).toEqual(chooseAiShot(board,human,difficulty,1));
   expect(board.pieces.some(p=>p.id===shot.pieceId&&p.owner===AI_BOT_ID)).toBe(true);
   expect(Math.hypot(shot.dx,shot.dy)).toBeGreaterThanOrEqual(MIN_FORCE);
   expect(Math.hypot(shot.dx,shot.dy)).toBeLessThanOrEqual(MAX_FORCE+.00001);
   expect(()=>simulateShot(board,AI_BOT_ID,shot)).not.toThrow();
   expect(JSON.stringify(board)).toBe(snapshot);
  });
 }
 it('rejects a finished game with no legal targets',()=>{
  expect(()=>chooseAiShot({pieces:[{id:'b1',owner:AI_BOT_ID,x:650,y:250}]},human,'hard',1)).toThrow('AI_NO_TARGET');
 });
});
