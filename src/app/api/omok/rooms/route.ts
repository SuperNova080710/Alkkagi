import { NextResponse, type NextRequest } from 'next/server';
import { executeOmokAction } from '@/lib/omok/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(_request: NextRequest) {
  const result = await executeOmokAction('create');
  return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
