import type {MetadataRoute} from 'next';
import {isSearchProduction,SITE_ORIGIN} from '@/lib/seo/site';

export default function sitemap():MetadataRoute.Sitemap {
  // Public landing page only: no UUID profiles, rooms, authenticated content,
  // session URLs, or forms in the sitemap.
  if (!isSearchProduction()) return [];
  return [{url:SITE_ORIGIN,changeFrequency:'weekly',priority:1}];
}
