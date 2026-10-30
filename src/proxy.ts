import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabase/config';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          previousCookies.forEach(cookie => response.cookies.set(cookie));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // Verify against Auth; never authorize using unverified getSession() data.
    // Pages/actions perform their own verification, including after refresh failure.
    try { await supabase.auth.getUser(); } catch { /* Fail closed in protected pages. */ }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/login', '/signup', '/lobby/:path*', '/profile/:path*', '/friends/:path*', '/messages/:path*', '/players/:path*', '/rooms/:path*', '/ranked/:path*', '/api/ai/:path*', '/api/players/:path*', '/api/experience/:path*', '/api/friends/:path*', '/api/messages/:path*', '/api/room-invites/:path*', '/auth/:path*'],
};
