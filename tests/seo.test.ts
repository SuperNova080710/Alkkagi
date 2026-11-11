import {afterEach,describe,expect,it,vi} from 'vitest';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import {SITE_ORIGIN,SITE_NAME,SITE_TITLE,SITE_DESCRIPTION} from '../src/lib/seo/site';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Home, {metadata as homeMetadata} from '../src/app/page';
import nextConfig from '../next.config';

afterEach(()=>{vi.unstubAllEnvs();});

describe('Public search indexing policy',()=>{
  it('publishes a sitemap with only the indexable public homepage and guide',()=>{
    vi.stubEnv('VERCEL_ENV','production');
    expect(sitemap()).toEqual([
      {url:SITE_ORIGIN,changeFrequency:'weekly',priority:1},
      {url:SITE_ORIGIN+'/how-to-play',changeFrequency:'monthly',priority:0.7},
      {url:SITE_ORIGIN+'/games/omok',changeFrequency:'monthly',priority:0.7},
      {url:SITE_ORIGIN+'/games/chess',changeFrequency:'monthly',priority:0.7},
      {url:SITE_ORIGIN+'/games/alkkagi',changeFrequency:'monthly',priority:0.7},
    ]);
    expect(SITE_ORIGIN).toBe('https://alkkagi-alpha.vercel.app');
  });

  it('does not publish a sitemap in preview or local builds',()=>{
    vi.stubEnv('VERCEL_ENV','preview');
    expect(sitemap()).toEqual([]);
    vi.stubEnv('VERCEL_ENV','development');
    expect(sitemap()).toEqual([]);
  });

  it('allows Googlebot to read noindex on private HTML pages in production',()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const rule=robots();
    expect(rule).toEqual({
      rules:{userAgent:'*',allow:'/',disallow:['/api/','/auth/']},
      sitemap:SITE_ORIGIN+'/sitemap.xml',
    });
    // A Disallow for HTML routes would hide their X-Robots-Tag from Googlebot.
    const serialized=JSON.stringify(rule);
    for(const path of ['/login','/signup','/lobby','/ranked','/rooms','/omok','/chess',
      '/profile','/players','/friends']){
      expect(serialized).not.toContain('"' + path + '"');
    }
  });

  it('allows crawler access to preview noindex, without advertising a sitemap',()=>{
    for(const env of ['preview','development']){
      vi.stubEnv('VERCEL_ENV',env);
      expect(robots()).toEqual({
        rules:{userAgent:'*',allow:'/',disallow:['/api/','/auth/']},
      });
      expect(sitemap()).toEqual([]);
    }
  });

  it('sets noindex on all protected HTML paths, leaving production home indexable',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const h=await nextConfig.headers?.();
    const expected=[
      '/login','/signup','/lobby/:path*','/ranked/:path*',
      '/rooms/:path*','/omok/:path*','/chess/:path*','/profile/:path*','/players/:path*',
      '/friends/:path*','/messages/:path*','/cosmetics/:path*','/qa/:path*','/api/:path*','/auth/:path*',
    ];
    expect(h?.map(x=>x.source)).toEqual(expected);
    expect(h?.some(x=>x.source==='/'||x.source==='/:path*')).toBe(false);
    expect(h?.every(x=>x.headers.some(v=>v.key==='X-Robots-Tag'
      &&v.value==='noindex, nofollow'))).toBe(true);

    // HTML routes must NOT be blocked in robots.txt, so crawlers can read noindex.
    const blocked=JSON.stringify(robots());
    for(const source of expected.slice(0,8)){
      expect(blocked).not.toContain(source.split('/')[1]);
    }
  });

  it('sets global noindex on preview HTML including home and private routes',async()=>{
    for(const env of ['preview','development']){
      vi.stubEnv('VERCEL_ENV',env);
      expect(await nextConfig.headers?.()).toEqual([{
        source:'/:path*',
        headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}],
      }]);
      // A blanket Disallow '/' would prevent bots from seeing this header.
      expect(JSON.stringify(robots())).not.toContain('"disallow":"/"');
    }
  });

  it('uses real game content rather than irrelevant keyword stuffing',()=>{
    expect(SITE_NAME).toBe('한판아레나');
    expect(SITE_TITLE).toBe('무료 온라인 오목·체스·알까기 게임 | 한판아레나');
    expect(homeMetadata.title).toEqual({absolute:SITE_TITLE});
    expect(homeMetadata.alternates?.canonical).toBe('/');
    for (const term of ['오목','체스','알까기','친구','AI','랭크전']) {
      expect(SITE_DESCRIPTION).toContain(term);
    }
  });

  it('emits one WebSite object on the home with the canonical origin and actual brand',()=>{
    const html=renderToStaticMarkup(createElement(Home));
    const scripts=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0][1])).toEqual({
      '@context':'https://schema.org',
      '@type':'WebSite',
      name:'한판아레나',
      alternateName:'HANPAN ARENA',
      url:SITE_ORIGIN+'/',
    });
  });
});
