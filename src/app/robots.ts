import type {MetadataRoute} from 'next';
import {isSearchProduction,SITE_ORIGIN} from '@/lib/seo/site';

export default function robots():MetadataRoute.Robots {
  // noindex must be crawlable: robots Disallow would prevent Googlebot from
  // reading the X-Robots-Tag on private HTML pages and preview deployments.
  // Authentication and RLS, not robots.txt, protect private application data.
  const rules:MetadataRoute.Robots['rules'] = {
    userAgent:'*',
    allow:'/',
    // These are non-HTML endpoints, not the indexable page surface.
    disallow:['/api/','/auth/'],
  };

  // Do not advertise a sitemap for Preview; every Preview response is noindex.
  if (!isSearchProduction()) return {rules};

  return {
    rules,
    sitemap:`${SITE_ORIGIN}/sitemap.xml`,
  };
}
