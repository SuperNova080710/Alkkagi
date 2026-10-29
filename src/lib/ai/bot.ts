import {MAX_FORCE,MIN_FORCE,simulateShot,type Board,type Shot} from '@/lib/game/engine';

export const AI_BOT_ID='00000000-0000-4000-8000-0000000000a1';
export const AI_DIFFICULTIES=['easy','normal','hard'] as const;
export type AiDifficulty=typeof AI_DIFFICULTIES[number];
export const DIFFICULTY_LABELS:Record<AiDifficulty,string>={
 easy:'쉬움',normal:'보통',hard:'어려움',
};
export function isAiDifficulty(value:unknown):value is AiDifficulty{
 return typeof value==='string'&&AI_DIFFICULTIES.includes(value as AiDifficulty);
}
function hashBoard(board:Board,turn:number){
 let value=(turn*2654435761)>>>0;
 for(const piece of board.pieces){
  for(const c of piece.id)value=(Math.imul(value,33)+c.charCodeAt(0))>>>0;
  value=(value+Math.round(piece.x*10)+Math.round(piece.y*10))>>>0;
 }
 return value;
}
function random(seed:number){
 let x=seed||1;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
function candidate(from:{x:number;y:number;id:string},to:{x:number;y:number},
 power:number,angle:number):Shot{
 const basis=Math.atan2(to.y-from.y,to.x-from.x)+angle;
 return {pieceId:from.id,dx:power*Math.cos(basis),dy:power*Math.sin(basis)};
}
function evaluate(before:Board,after:Board,humanId:string){
 const enemyBefore=before.pieces.filter(p=>p.owner===humanId).length;
 const enemyAfter=after.pieces.filter(p=>p.owner===humanId).length;
 const ownBefore=before.pieces.filter(p=>p.owner===AI_BOT_ID).length;
 const ownAfter=after.pieces.filter(p=>p.owner===AI_BOT_ID).length;
 const center=after.pieces.filter(p=>p.owner===AI_BOT_ID)
  .reduce((sum,p)=>sum+Math.min(p.x,800-p.x,p.y,500-p.y),0);
 return (enemyBefore-enemyAfter)*130-(ownBefore-ownAfter)*160+
  center*0.006;
}
export function chooseAiShot(board:Board,humanId:string,
 difficulty:AiDifficulty,turn:number):Shot{
 const own=board.pieces.filter(p=>p.owner===AI_BOT_ID);
 const enemy=board.pieces.filter(p=>p.owner===humanId);
 if(!own.length||!enemy.length)throw Error('AI_NO_TARGET');
 const nearest=own.flatMap(p=>enemy.map(target=>({
  p,target,distance:Math.hypot(p.x-target.x,p.y-target.y),
 }))).sort((a,b)=>a.distance-b.distance||a.p.id.localeCompare(b.p.id)||a.target.id.localeCompare(b.target.id));
 const rnd=random(hashBoard(board,turn));
 if(difficulty==='easy'){
  const selected=nearest[Math.floor(rnd()*Math.min(5,nearest.length))];
  return candidate(selected.p,selected.target,75+rnd()*50,(rnd()-.5)*0.7);
 }
 const budget=difficulty==='hard'?48:16;
 const powers=difficulty==='hard'?[100,116,125,90]:[105,125];
 const angles=difficulty==='hard'?[-.26,0,.26,-.12,.12]:[-.18,0,.18];
 const shots:Shot[]=[];
 for(const v of nearest){
  for(const force of powers)for(const angle of angles){
   shots.push(candidate(v.p,v.target,force,angle));
   if(shots.length>=budget)break;
  }
  if(shots.length>=budget)break;
 }
 let best=shots[0],bestScore=-Infinity;
 for(const shot of shots){
  const magnitude=Math.hypot(shot.dx,shot.dy);
  if(magnitude<MIN_FORCE||magnitude>MAX_FORCE+.00001)continue;
  try{
   const after=simulateShot(board,AI_BOT_ID,shot);
   const score=evaluate(board,after,humanId);
   if(score>bestScore){bestScore=score;best=shot;}
  }catch{continue;}
 }
 return best;
}
