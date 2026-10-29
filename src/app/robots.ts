import type {MetadataRoute} from 'next';
import {isSearchProduction,SITE_ORIGIN} from '@/lib/seo/site';

export default function robots():MetadataRoute.Robots {
  // Preview URLs should not compete with the production canonical domain.
  if (!isSearchProduction()) {
    return {rules:{userAgent:'*',disallow:'/'}};
  }
  return {
    rules:{
      userAgent:'*',
      allow:'/',
      disallow:[
        '/api/',
        '/auth/',
        '/lobby',
        '/ranked',
        '/rooms',
        '/profile',
        '/players',
        '/friends',
      ],
    },
    sitemap:`${SITE_ORIGIN}/sitemap.xml`,
  };
}
