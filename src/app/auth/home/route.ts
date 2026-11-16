import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/user';

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const destination = new URL(user ? '/lobby' : '/', request.url);
  return NextResponse.redirect(destination, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
