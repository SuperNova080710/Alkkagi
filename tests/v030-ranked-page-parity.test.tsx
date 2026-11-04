import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OmokRankedLobby } from '../src/components/omok/omok-ranked-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

describe('#290 Omok and Alkkagi ranked page layout parity', () => {
  it('uses the same three stats, matchmaking column and two content cards', () => {
    const html = renderToStaticMarkup(<OmokRankedLobby nickname="같은 닉네임"/>);
    expect(html).toContain('arena-service-heading');
    expect(html).toContain('arena-service-name');
    expect(html).toContain('같은 닉네임');
    expect(html.match(/class="arena-stats"/g)).toHaveLength(1);
    expect(html.match(/class="arena-panel /g)).toHaveLength(5);
    expect(html).toContain('arena-ranked-main');
    expect(html).toContain('arena-service-controls');
    expect(html).toContain('arena-ranking-grid');
    expect(html).toContain('리더보드 TOP 100');
    expect(html).toContain('오목 랭크 안내');
    expect(html).toContain('오목 RP');
    expect(html).toContain('90초');
    expect(html).toContain('랭크 매칭 시작');
    expect(html).toContain('aria-label="오목 랭킹"');
    expect(html).not.toContain('arena-omok-ranked-summary');
  });

  it('keeps Omok ranking stats sourced from its independent API', () => {
    const source = readFileSync(new URL('../src/components/omok/omok-ranked-client.tsx', import.meta.url),'utf8');
    expect(source).toContain("'/api/omok/ranked/queue'");
    expect(source).toContain("'/api/omok/ranked/dashboard'");
    expect(source).toContain("router.replace('/omok/ranked/matches/'");
    expect(source).not.toContain("'/api/ranked/");
    expect(source).not.toContain('ranked_dashboard');
  });

  it('shares the ranked page shell and preserves game-specific feature flag', () => {
    const page = readFileSync(new URL('../src/app/omok/ranked/page.tsx', import.meta.url),'utf8');
    const ranked = readFileSync(new URL('../src/components/ranked/ranked-view.tsx', import.meta.url),'utf8');
    for(const source of [page, ranked]){
      expect(source).toContain('arena-service arena-service--ranked');
      expect(source).toContain('section="ranked"');
    }
    expect(page).toContain("process.env.OMOK_UI_ENABLED !== 'true'");
    expect(page).toContain("from('profiles').select('nickname')");
    expect(page).toContain('game="omok"');
    expect(page).toContain('<OmokRankedLobby nickname=');
  });

  it('uses shared panel tokens without hiding six-column table overflow', () => {
    const css = readFileSync(new URL('../src/components/omok/omok-competitive.css', import.meta.url),'utf8');
    expect(css).toContain('var(--arena-cream)');
    expect(css).toContain('var(--arena-line)');
    expect(css).toContain('.arena-omok-ranked-table-scroll');
    expect(css).toContain('overflow:auto');
    expect(css).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
  });
});
