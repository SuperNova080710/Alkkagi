import 'server-only';

// Do not build email redirects from client-controlled Host/Origin headers.
export function getAuthOrigin() {
  const value = process.env.SITE_URL || 'https://alkkagi-alpha.vercel.app';
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Invalid SITE_URL');
  }
  return url.origin;
}
