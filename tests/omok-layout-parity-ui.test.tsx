import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OmokMatchPanel, type OmokParticipant } from '../src/components/omok/omok-match-panels';
import { OmokResultOverlay } from '../src/components/omok/omok-result-overlay';
import { OmokLobbyModes } from '../src/components/omok/omok-lobby-modes';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me: OmokParticipant = { id: 'me', nickname: '나', stone: 'black' };
const other: OmokParticipant = { id: 'other', nickname: '친구', stone: 'white' };
const board = Array.from({ length: 15 }, () => Array<null>(15).fill(null));

function match(outcome: 'me' | 'other' | null, mode: 'casual' | 'ranked' = 'casual') {
  return renderToStaticMarkup(
    <OmokMatchPanel board={board} players={[me, other]} currentUserId="me"
      turnUserId="other" status="finished" winnerId={outcome} finishReason={outcome ? 'five' : 'draw'}
      mode={mode} onReturn={() => {}} onRematch={mode === 'casual' ? () => {} : undefined}
      onRankedReplay={mode === 'ranked' ? () => {} : undefined}
      rematchReadyCount={1} />,
  );
}
describe('Omok matches Alkkagi lobby, result and sizing (#261)', () => {
  it('uses three Alkkagi-sized mode cards and the same casual-entry dialog flow', () => {
    const html = renderToStaticMarkup(<OmokLobbyModes/>);
    expect(html.match(/class="arena-mode arena-mode--/g)).toHaveLength(3);
    expect(html.match(/arena-mode--omok/g)).toHaveLength(3);
    expect(html).toContain('aria-label="오목 대전 방식"');
    expect(html).toContain('aria-labelledby="omok-mode-dialog-title"');
    expect(html).toContain('새 방 만들기');
    expect(html).toContain('코드로 참가');
    expect(html).toContain('href="/omok/ranked"');
    expect(html).not.toContain('href="/omok/ai"');
    expect(html).toContain('AI 연습 시작');
    expect(html).not.toContain('href="#omok-casual-start"');
  });

  it('shows winner, loser and draw only when the server says the match has finished', () => {
    const victory = match('me');
    expect(victory).toContain('MATCH RESULT');
    expect(victory).toContain('승리');
    expect(victory).toContain('상대방을 이겼습니다.');
    expect(victory).toContain('재도전 · 다시하기');
    expect(victory).toContain('로비로 돌아가기');
    expect(victory).toContain('재대전 · 1/2');
    expect(victory.match(/role="gridcell"/g)).toHaveLength(225);
    expect(victory.match(/aria-disabled="true"/g)).toHaveLength(225);
    expect(match('other')).toContain('상대방이 승리했습니다.');
    expect(match(null)).toContain('서로 비겼습니다.');
    expect(match('me', 'ranked')).toContain('재도전 · 새 랭크 매칭');
    expect(match('me', 'ranked')).not.toContain('재대전 · 1/2');

    const active = renderToStaticMarkup(<OmokMatchPanel board={board}
      players={[me, other]} currentUserId="me" turnUserId="me" status="active"
      onPlace={() => {}} onForfeit={() => {}}/>);
    expect(active).not.toContain('MATCH RESULT');
    expect(active).toContain('기권');
  });

  it('keeps the AI result in the same overlay style without inventing RP', () => {
    const ai = renderToStaticMarkup(<OmokResultOverlay outcome="패배" mode="ai"
      finishReason="forfeit" onReplay={() => {}} onReturn={() => {}}/>);
    expect(ai).toContain('MATCH RESULT');
    expect(ai).toContain('패배');
    expect(ai).toContain('기권');
    expect(ai).toContain('다시하기 · 난이도 선택');
    expect(ai).not.toContain('RP 변동');
    const source = readFileSync(new URL('../src/components/omok/omok-ai-client.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<OmokResultOverlay');
    expect(source).toContain('onReplay={chooseReplayDifficulty}');
    expect(source).toContain('replayDialog.current?.showModal()');
    expect(source).toContain('initialDifficulty={snapshot.difficulty}');
    expect(source).not.toContain('async function again()');
    expect(source).toContain("snapshot.winner === 'human'");
    expect(source).not.toContain('calculateWinner');
  });

  it('keeps chat and real ranked settlement beside the board, not below it', () => {
    const client = readFileSync(new URL('../src/components/omok/omok-match-client.tsx', import.meta.url), 'utf8');
    expect(client).toContain('chat={<OmokChatPanel');
    expect(client).toContain('<OmokRankedMatchMeta');
    expect(client).toContain('onRankedReplay=');
    expect(client).toContain('parseQueueState');
    expect(client).toContain('omok:refresh');
    const panel = readFileSync(new URL('../src/components/omok/omok-match-panels.tsx', import.meta.url), 'utf8');
    expect(panel).toContain('arena-omok-board-stage');
    expect(panel).toContain('{extra}');
    expect(panel).toContain('{chat}');
    const rankedPage = readFileSync(
      new URL('../src/app/omok/ranked/matches/[id]/page.tsx', import.meta.url), 'utf8');
    expect(rankedPage).not.toContain('<OmokRankedMatchMeta');
  });

  it('shrinks a square board using viewport height rather than hide document scrolling', () => {
    const css = readFileSync(new URL('../src/components/omok/omok-parity.css', import.meta.url), 'utf8');
    expect(css).toContain('max(250px,calc(100dvh - 480px))');
    expect(css).toContain('width:min(100%,510px');
    expect(css).toContain('including ArenaShell header');
    expect(css).toContain('@media(max-width:880px)');
    expect(css).toContain('@media(max-width:480px)');
    expect(css).toContain('max-height:clamp(60px,15dvh,170px)');
    expect(css).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
    expect(css).not.toMatch(/zoom\s*:/);
    const boardCss = readFileSync(new URL('../src/components/omok/omok-board.css', import.meta.url), 'utf8');
    expect(boardCss).toContain('aspect-ratio: 1');
    expect(boardCss).toContain('min-height: 44px');
  });
});
