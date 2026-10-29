import {afterEach,describe,expect,it,vi} from 'vitest';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import {SITE_ORIGIN,SITE_TITLE,SITE_DESCRIPTION} from '../src/lib/seo/site';
import nextConfig from '../next.config';

afterEach(()=>{vi.unstubAllEnvs();});

describe('Public search indexing policy',()=>{
  it('publishes a sitemap with only the indexable production home',()=>{
    vi.stubEnv('VERCEL_ENV','production');
    expect(sitemap()).toEqual([{
      url:SITE_ORIGIN,changeFrequency:'weekly',priority:1,
    }]);
    expect(SITE_ORIGIN).toBe('https://alkkagi-alpha.vercel.app');
  });

  it('does not publish a sitemap in preview or local builds',()=>{
    vi.stubEnv('VERCEL_ENV','preview');
    expect(sitemap()).toEqual([]);
    vi.stubEnv('VERCEL_ENV','development');
    expect(sitemap()).toEqual([]);
  });

  it('allows a production crawler to find the home, but excludes private paths',()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const rule=robots();
    expect(rule).toHaveProperty('sitemap',SITE_ORIGIN+'/sitemap.xml');
    expect(rule).toMatchObject({rules:{
      userAgent:'*',allow:'/',
      disallow:expect.arrayContaining(['/auth/','/api/','/players','/rooms','/ranked','/lobby']),
    }});
    expect(JSON.stringify(rule)).not.toContain('/login');
    expect(JSON.stringify(rule)).not.toContain('/signup');
  });

  it('denies all crawler paths in non-production deployments',()=>{
    vi.stubEnv('VERCEL_ENV','preview');
    expect(robots()).toEqual({rules:{userAgent:'*',disallow:'/'}});
    vi.stubEnv('VERCEL_ENV','development');
    expect(robots()).toEqual({rules:{userAgent:'*',disallow:'/'}});
  });

  it('sets X-Robots-Tag noindex on authenticated production routes only',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const h=await nextConfig.headers?.();
    expect(h).toBeDefined();
    expect(h?.some(x=>x.source==='/login')).toBe(true);
    expect(h?.some(x=>x.source==='/rooms/:path*')).toBe(true);
    expect(h?.some(x=>x.source==='/:path*')).toBe(false);
    expect(h?.every(x=>x.headers.some(v=>v.key==='X-Robots-Tag'&&v.value==='noindex, nofollow'))).toBe(true);
  });

  it('sets X-Robots-Tag noindex on every preview URL',async()=>{
    vi.stubEnv('VERCEL_ENV','preview');
    const h=await nextConfig.headers?.();
    expect(h).toEqual([{
      source:'/:path*',
      headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}],
    }]);
  });

  it('uses real game content rather than irrelevant keyword stuffing',()=>{
    expect(SITE_TITLE).toContain('알까기');
    expect(SITE_DESCRIPTION).toContain('온라인 1:1 알까기');
    expect(SITE_DESCRIPTION).toContain('AI');
  });
});
