import { NextResponse } from 'next/server';
import { executeOmokAction } from '@/lib/omok/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const result=await executeOmokAction('room',{roomId:id});
  return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(_request: Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const result=await executeOmokAction('leave',{roomId:id});
  return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
