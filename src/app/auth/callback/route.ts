import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code && !request.nextUrl.searchParams.has('error')) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(new URL('/lobby', request.url));
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
      }
    } catch { /* Expired/used codes and configuration errors use a generic failure. */ }
  }
  const response = NextResponse.redirect(new URL('/login?error=callback', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
