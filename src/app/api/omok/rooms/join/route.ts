import { NextResponse, type NextRequest } from 'next/server';
import { executeOmokAction } from '@/lib/omok/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error:'INVALID_REQUEST'},{status:400}); }
  const code = body && typeof body==='object' && !Array.isArray(body) ? (body as Record<string,unknown>).code : null;
  const result = await executeOmokAction('join',{code});
  return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
