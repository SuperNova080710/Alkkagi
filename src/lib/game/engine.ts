export const WIDTH=800, HEIGHT=500, RADIUS=18;
export type Piece={id:string;owner:string;x:number;y:number};
export type Board={pieces:Piece[]};
export type Shot={pieceId:string;dx:number;dy:number};
export function validBoard(value:unknown):value is Board {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const pieces=(value as Board).pieces;
 return Array.isArray(pieces)&&pieces.length<=10&&pieces.every(p=>p&&
  typeof p.id==='string'&&typeof p.owner==='string'&&
  Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=WIDTH&&p.y>=0&&p.y<=HEIGHT);
}
export function simulateShot(board:Board,actor:string,shot:Shot):Board{
 if(!validBoard(board)||!Number.isFinite(shot.dx)||!Number.isFinite(shot.dy))throw Error('INVALID_SHOT');
 const length=Math.hypot(shot.dx,shot.dy);
 if(length<5||length>160)throw Error('INVALID_FORCE');
 const target=board.pieces.find(p=>p.id===shot.pieceId);
 if(!target||target.owner!==actor)throw Error('NOT_YOUR_PIECE');
 const pieces=board.pieces.map(p=>({...p,vx:0,vy:0}));
 const moving=pieces.find(p=>p.id===shot.pieceId)!;
 moving.vx=shot.dx*0.135;moving.vy=shot.dy*0.135;
 for(let frame=0;frame<800;frame++){
  let active=false;
  for(const p of pieces){
   p.x+=p.vx;p.y+=p.vy;
   p.vx*=0.984;p.vy*=0.984;
   if(Math.abs(p.vx)+Math.abs(p.vy)<0.07){p.vx=0;p.vy=0;}
   if(p.vx!==0||p.vy!==0)active=true;
  }
  for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
   const a=pieces[i],b=pieces[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>=RADIUS*2||d<0.00001)continue;
   const nx=dx/d,ny=dy/d,overlap=(RADIUS*2-d)/2;
   a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
   const approach=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
   if(approach<0){
    const impulse=-(1+0.92)*approach/2;
    a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
   }
  }
  for(let i=pieces.length-1;i>=0;i--){
   const p=pieces[i];
   if(p.x<RADIUS||p.x>WIDTH-RADIUS||p.y<RADIUS||p.y>HEIGHT-RADIUS)pieces.splice(i,1);
  }
  if(!active)break;
 }
 return {pieces:pieces.map(({id,owner,x,y})=>({id,owner,x:Math.round(x*100)/100,y:Math.round(y*100)/100}))};
}
export function outcome(board:Board,player1:string,player2:string){
 const first=board.pieces.some(p=>p.owner===player1);
 const second=board.pieces.some(p=>p.owner===player2);
 const finished=!first||!second;
 return {finished,winnerId:!first&&second?player2:first&&!second?player1:null};
}
