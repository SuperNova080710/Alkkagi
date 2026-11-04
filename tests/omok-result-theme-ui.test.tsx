import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OmokResultOverlay } from '../src/components/omok/omok-result-overlay';
const alkkagi = readFileSync(new URL('../src/app/arena.css', import.meta.url), 'utf8');
const omok = readFileSync(new URL('../src/components/omok/omok-result-parity.css', import.meta.url), 'utf8');
describe('#263 Alkkagi-themed Omok result card', () => {
  it.each(['승리', '패배', '무승부'] as const)('keeps server outcome %s and shared MATCH RESULT', outcome => {
    for(const mode of ['casual','ranked','ai'] as const) {
      const html=renderToStaticMarkup(<OmokResultOverlay outcome={outcome} mode={mode}
        finishReason="timeout" onReturn={() => {}} onReplay={() => {}}/>);
      expect(html).toContain('arena-omok-result-overlay');
      expect(html).toContain('MATCH RESULT');
      expect(html).toContain(outcome);
      expect(html).toContain('시간 초과');
      expect(html).toContain('로비로 돌아가기');
    }
  });
  it('uses the same explicit backdrop, border and background tokens as Alkkagi', () => {
    for(const token of ['#1d2119b3','#dfbf76','var(--arena-cream)','var(--arena-shadow)']){
      expect(alkkagi).toContain(token);
      expect(omok).toContain(token);
    }
    expect(omok).toContain('button.bg-emerald-300');
    expect(omok).toContain('min-height: 44px');
    expect(omok).toContain('position: relative');
    expect(omok).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
  });
  it('keeps rematch pending/disabled and original result focus behavior', () => {
    const html = renderToStaticMarkup(<OmokResultOverlay outcome="패배" mode="casual"
      myRematchVote onReplay={()=>{}} onReturn={()=>{}}/>);
    expect(html).toContain('상대 수락 대기 중');
    expect(html).toMatch(/disabled=""/);
    expect(html).toContain('tabindex="-1"');
  });
});
