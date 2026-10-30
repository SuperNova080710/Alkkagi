import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../src/app/page';
import HowToPlayPage, { metadata } from '../src/app/how-to-play/page';

describe('public how-to-play guide', () => {
  it('renders without credentials and keeps a single semantic h1', () => {
    const html = renderToStaticMarkup(<HowToPlayPage />);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('알까기, 어떻게 하는 게임인가요?');
    expect(html).toContain('다섯 개의 알');
    expect(html).toContain('키보드 조작');
    expect(html).toContain('무승부');
    expect(html).toContain('8자리 초대 코드');
    expect(html).toContain('쉬움·보통·어려움');
    expect(html).toContain('href="/lobby"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="#guide-controls"');
    expect(html).toContain('href="#guide-modes"');
    expect(html).toContain('href="#guide-faq"');
    expect(html.match(/<details\b/g)).toHaveLength(5);
    expect(html).toContain('aria-label="가이드 목차"');
  });

  it('provides page-specific SEO metadata without making the guide private', () => {
    expect(metadata.title).toContain('규칙·조작법');
    expect(metadata.description).toContain('키보드');
    expect(metadata.alternates?.canonical).toBe('https://alkkagi-alpha.vercel.app/how-to-play');
    expect(metadata.robots).toBeDefined();
  });

  it('links to the public guide from the existing home route', () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('href="/how-to-play"');
    expect(html).toContain('알까기 규칙과 조작법 보기');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/lobby"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});
