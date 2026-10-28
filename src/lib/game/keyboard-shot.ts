import {MAX_FORCE,MIN_FORCE} from './engine';
export const DIRECTIONS=[
 {value:'right',label:'→ 오른쪽',degrees:0},
 {value:'down-right',label:'↘ 오른쪽 아래',degrees:45},
 {value:'down',label:'↓ 아래',degrees:90},
 {value:'down-left',label:'↙ 왼쪽 아래',degrees:135},
 {value:'left',label:'← 왼쪽',degrees:180},
 {value:'up-left',label:'↖ 왼쪽 위',degrees:225},
 {value:'up',label:'↑ 위',degrees:270},
 {value:'up-right',label:'↗ 오른쪽 위',degrees:315},
] as const;
export type Direction=(typeof DIRECTIONS)[number]['value'];
export function keyboardVector(direction:Direction,power:number){
 const angle=DIRECTIONS.find(p=>p.value===direction);
 if(!angle||!Number.isFinite(power)||power<MIN_FORCE+1||power>MAX_FORCE)
  throw Error('INVALID_KEYBOARD_SHOT');
 const rad=angle.degrees*Math.PI/180;
 return {dx:power*Math.cos(rad),dy:power*Math.sin(rad)};
}
