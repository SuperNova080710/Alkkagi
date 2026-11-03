import { NextResponse, type NextRequest } from 'next/server';
import { executeOmokAction } from '@/lib/omok/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  let body: unknown;
  try { body=await request.json(); } catch { return NextResponse.json({error:'INVALID_REQUEST'},{status:400}); }
  if(!body || typeof body!=='object' || Array.isArray(body))
    return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
  const result=await executeOmokAction('move',{...body,matchId:id});
  return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
