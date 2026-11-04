import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { LobbyView, type LobbyData } from '../src/components/lobby/lobby-view';
import { OmokLobbyView, type OmokLobbyData } from '../src/components/omok/omok-lobby-view';
import { OmokLobbyModes } from '../src/components/omok/omok-lobby-modes';
import { OmokRoomPanel } from '../src/components/omok/omok-match-panels';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const alkkagi: LobbyData = {
  nickname: '공통 프로필', rating: 1510, leaderboard: [], rankingUnavailable: false,
  activeCasual: [], activeAi: [], recoveryUnavailable: false,
};
const omok: OmokLobbyData = {
  nickname: '공통 프로필', rating: 920, leaderboard: [], rankingUnavailable: false,
  activeCasual: [], activeAi: [], recoveryUnavailable: false,
};

describe('v0.3.0 Preview visual feedback: lobby recovery / dialog / waiting room (#270 #279 #280)', () => {
  it('removes the large empty recovery card from both games', () => {
    const a = renderToStaticMarkup(<LobbyView data={alkkagi} modes={<p>모드</p>} omokEnabled/>);
    const o = renderToStaticMarkup(<OmokLobbyView data={omok}/>);
    for (const html of [a, o]) {
      expect(html).not.toContain('class="arena-panel arena-recovery"');
      expect(html).not.toContain('aria-label="진행 중인 경기 이어하기"');
      expect(html).not.toContain('진행 중인 경기가 없어요');
    }
  });

  it('preserves small active-match resume links for casual, AI and ranked', () => {
    const a = renderToStaticMarkup(<LobbyView
      data={{ ...alkkagi, activeCasual: [{ id:'a', room_id:'room-a' }], activeAi:[{room_id:'ai-a'}] }}
      modes={<p>모드</p>} omokEnabled/>);
    const o = renderToStaticMarkup(<OmokLobbyView data={{ ...omok, activeCasual:[
      { id:'ranked-a', room_id:null, mode:'ranked' },
      { id:'casual-a', room_id:'omok-room-a', mode:'casual' },
    ], activeAi:[{id:'ai-omok-a'}] }}/>);
    for (const html of [a,o]) {
      expect(html).toContain('arena-recovery-inline');
      expect(html).toContain('aria-label="진행 중인 경기 이어하기"');
      expect(html).not.toContain('class="arena-panel arena-recovery"');
    }
    expect(a).toContain('href="/rooms/room-a"');
    expect(a).toContain('href="/rooms/ai-a/ai"');
    expect(o).toContain('href="/omok/ranked/matches/ranked-a"');
    expect(o).toContain('href="/omok/matches/casual-a"');
    expect(o).toContain('href="/omok/ai/ai-omok-a"');
  });

  it('uses Alkkagi casual dialog dimensions and same two-card entry layout', () => {
    const html = renderToStaticMarkup(<OmokLobbyModes/>);
    expect(html).toContain('class="arena-dialog"');
    expect(html).not.toContain('arena-omok-entry-dialog');
    expect(html).toContain('arena-dialog-heading');
    expect(html).toContain('arena-room-form-grid');
    expect(html.match(/class="arena-room-entry-card(?: arena-room-entry-card--join)?"/g)).toHaveLength(2);
    expect(html).toContain('arena-room-card-mark');
    expect(html).toContain('새로운 방 만들기');
    expect(html).toContain('초대 코드로 참가');
    expect(html).toContain('arena-room-code-input');
    expect(html).toContain('arena-button arena-button--gold');
    expect(html).toContain('arena-button arena-button--blue');
    expect(html).toContain('15×15 오목');
    const css = readFileSync(new URL('../src/components/omok/omok-parity.css', import.meta.url), 'utf8');
    expect(css).not.toContain('.arena-omok-entry-dialog');
  });

  it('uses the same full-page waiting shell rather than nesting an ArenaShell', () => {
    const route = readFileSync(new URL('../src/app/omok/rooms/[id]/page.tsx', import.meta.url),'utf8');
    expect(route).toContain('arena-waiting arena-waiting--v2 mx-auto max-w-5xl');
    expect(route).toContain('game-page-back arena-room-back');
    expect(route).not.toContain('<ArenaShell');
    expect(route).toContain("process.env.ROOM_INVITES_UI_ENABLED === 'true'");
    const html = renderToStaticMarkup(<OmokRoomPanel
      code="ABCDEFGH" players={[{id:'me',nickname:'나',stone:'black'}]}
      currentUserId="me" hostId="me" onLeave={() => {}} onStart={() => {}}/>);
    expect(html).toContain('class="arena-invite"');
    expect(html).toContain('arena-room-seats');
    expect(html).toContain('arena-room-main-action');
    expect(html).toContain('arena-button arena-button--gold');
    expect(html).toContain('방 닫기');
    expect(html).not.toContain('class="arena-waiting--v2 arena-omok-waiting"');
  });
});
