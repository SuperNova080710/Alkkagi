import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OmokAiModalEntry, createOmokAiMatch } from '../src/components/omok/omok-ai-modal-entry';
import { OmokLobbyModes } from '../src/components/omok/omok-lobby-modes';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const matchId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

describe('v0.3 Omok AI direct-start dialog (#284)', () => {
  it('shows accessible difficulty controls and a single launch button', () => {
    const html = renderToStaticMarkup(<OmokAiModalEntry/>);
    expect(html).toContain('AI 난이도 선택');
    expect(html.match(/name="omok-ai-difficulty"/g)).toHaveLength(3);
    expect(html).toContain('쉬움');
    expect(html).toContain('보통');
    expect(html).toContain('어려움');
    expect(html).toContain('AI 대전 시작');
    expect(html).not.toContain('선택한 난이도 확인');
    expect(html).toContain('arena-omok-ai-dialog-entry');
  });

  it('creates the existing server-backed match with the selected difficulty', async () => {
    const request = vi.fn(async () => ({ matchId }));
    await expect(createOmokAiMatch('hard', request)).resolves.toBe(matchId);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/api/omok/ai', {
      method: 'POST', body: { difficulty: 'hard' },
    });
  });

  it('never navigates using an invented or missing match ID', async () => {
    const request = vi.fn(async () => ({ matchId: 'invalid-match' }));
    await expect(createOmokAiMatch('easy', request)).rejects.toThrow('AI_CREATE_INVALID');
    const missing = vi.fn(async () => ({ status: 'ready' }));
    await expect(createOmokAiMatch('normal', missing)).rejects.toThrow('AI_CREATE_INVALID');
  });

  it('keeps casual and ranked modes intact and opens AI through the same dialog', () => {
    const html = renderToStaticMarkup(<OmokLobbyModes/>);
    expect(html).toContain('class="arena-dialog"');
    expect(html).toContain('aria-labelledby="omok-mode-dialog-title"');
    expect(html).toContain('AI 연습 시작');
    expect(html).toContain('href="/omok/ranked"');
    expect(html).not.toContain('href="/omok/ai"');
    expect(html).toContain('새로운 방 만들기');
    expect(html).toContain('초대 코드로 참가');

    const source = readFileSync(new URL('../src/components/omok/omok-lobby-modes.tsx', import.meta.url),'utf8');
    expect(source).toContain("open('ai')");
    expect(source).toContain('<OmokAiModalEntry onPendingChange={setAiPending}/>');
    expect(source).toContain('if (aiPending) event.preventDefault()');
  });
});
