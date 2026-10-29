import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerSearch } from '../src/components/players/player-search';
import { PublicPlayer } from '../src/components/players/public-player';
import { VisibilitySettings } from '../src/components/profile/visibility-settings';
import { PlayerFeedback } from '../src/components/players/player-feedback';
import { playerRequest } from '../src/components/players/use-player-resource';

afterEach(() => vi.unstubAllGlobals());
describe('player directory UI boundaries', () => {
  it('does not expose invented search results, stats or default privacy controls before loading', () => {
    const search = renderToStaticMarkup(<PlayerSearch/>);
    expect(search).toContain('닉네임을 2자 이상');
    expect(search).not.toContain('검색 결과가 없습니다');
    const detail = renderToStaticMarkup(<PublicPlayer id="00000000-0000-0000-0000-000000000011"/>);
    expect(detail).toContain('불러오고');
    expect(detail).not.toContain('1,000');
    const settings = renderToStaticMarkup(<VisibilitySettings/>);
    expect(settings).toContain('기존 랭크 순위표');
    expect(settings).not.toContain('type="checkbox"');
  });
  it('offers login only for expired sessions, not hidden or unavailable profiles', () => {
    const auth = renderToStaticMarkup(<PlayerFeedback status={401} retry={() => {}}/>);
    expect(auth).toContain('href="/login"');
    const hidden = renderToStaticMarkup(<PlayerFeedback status={404} retry={() => {}}/>);
    expect(hidden).toContain('찾을 수 없거나 공개되지');
    expect(hidden).not.toContain('href="/login"');
    const unavailable = renderToStaticMarkup(<PlayerFeedback status={503} retry={() => {}}/>);
    expect(unavailable).toContain('다시 시도');
    expect(unavailable).not.toContain('href="/login"');
  });
  it('uses same-origin cookies and no-store while preserving mutation payload', async () => {
    const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{discoverable:false,showRankedStats:true}})});
    vi.stubGlobal('fetch',fetcher);
    const body = JSON.stringify({discoverable:false,showRankedStats:true});
    expect(await playerRequest('/api/players/me/settings',{method:'PUT',body})).toEqual({discoverable:false,showRankedStats:true});
    expect(fetcher).toHaveBeenCalledWith('/api/players/me/settings',expect.objectContaining({method:'PUT',body,credentials:'same-origin',cache:'no-store'}));
  });
  it('rejects API errors without leaking the server response body', async () => {
    const json = vi.fn();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json}));
    await expect(playerRequest('/api/players/me')).rejects.toMatchObject({status:503,message:'Player request failed'});
    expect(json).not.toHaveBeenCalled();
  });
});
