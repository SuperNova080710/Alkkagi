import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LobbyIdentitySummary } from '../src/components/lobby/lobby-identity-summary';
import { LobbyView, type LobbyData } from '../src/components/lobby/lobby-view';
import { OmokLobbyView, type OmokLobbyData } from '../src/components/omok/omok-lobby-view';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const alkkagi: LobbyData = {
  nickname: '동일계정', rating: 1550, leaderboard: [], rankingUnavailable: false,
  activeCasual: [], activeAi: [], recoveryUnavailable: false,
};
const omok: OmokLobbyData = {
  nickname: '동일계정', rating: 980, leaderboard: [], rankingUnavailable: false,
  activeCasual: [], activeAi: [], recoveryUnavailable: false,
};
describe('#268 same identity across games', () => {
  it('reuses one profile summary with independent RP', () => {
    const a = renderToStaticMarkup(<LobbyIdentitySummary nickname="동일계정" rating={1550}
      game="alkkagi" experienceEnabled/>);
    const o = renderToStaticMarkup(<LobbyIdentitySummary nickname="동일계정" rating={980}
      game="omok" experienceEnabled/>);
    expect(a).toContain('동일계정'); expect(o).toContain('동일계정');
    expect(a).toContain('1,550 RP'); expect(o).toContain('980 오목 RP');
    expect(a).toContain('레벨 확인 중'); expect(o).toContain('레벨 확인 중');
    expect(a).not.toContain('980 오목 RP'); expect(o).not.toContain('1,550 RP');
  });
  it('uses identical avatar and profile path on both lobby screens', () => {
    const a = renderToStaticMarkup(<LobbyView data={alkkagi} modes={<div>게임</div>}
      experienceEnabled cosmeticsEnabled/>);
    const o = renderToStaticMarkup(<OmokLobbyView data={omok}
      experienceEnabled cosmeticsEnabled/>);
    for (const html of [a,o]) {
      expect(html).toContain('arena-player-summary--shared');
      expect(html).toContain('href="/profile"');
      expect(html).toContain('레벨 확인 중');
      expect(html).toContain('아바타 확인 중');
      expect(html).toContain('동일계정');
    }
    expect(a).not.toContain('980 오목 RP'); expect(o).not.toContain('1,550 RP');
  });
  it('keeps feature gates OFF with non-fabricated values', () => {
    const x = renderToStaticMarkup(<LobbyIdentitySummary nickname="기본" rating={null}
      game="omok"/>);
    expect(x).not.toContain('레벨 확인 중');
    expect(x).not.toContain('아바타 확인 중');
    expect(x).toContain('오목 RP를 불러오지 못했어요');
  });
});
