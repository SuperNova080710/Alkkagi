import type {MetadataRoute} from 'next';
import {isSearchProduction,SITE_ORIGIN} from '@/lib/seo/site';

export default function sitemap():MetadataRoute.Sitemap {
  // Public home and public guide only: no UUID profiles, rooms, authenticated content,
  // session URLs, or forms in the sitemap.
  if (!isSearchProduction()) return [];
  return [
    {url:SITE_ORIGIN,changeFrequency:'weekly',priority:1},
    {url:`${SITE_ORIGIN}/how-to-play`,changeFrequency:'monthly',priority:0.7},
  ];
}
