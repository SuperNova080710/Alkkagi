import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OmokAiModalEntry } from '../src/components/omok/omok-ai-modal-entry';
import { OmokResultOverlay } from '../src/components/omok/omok-result-overlay';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

describe('#289 replay AI match with editable difficulty', () => {
  it.each(['easy', 'normal', 'hard'] as const)('opens shared radio selector preselected to %s', difficulty => {
    const html = renderToStaticMarkup(<OmokAiModalEntry initialDifficulty={difficulty}/>);
    expect(html).toContain('AI 난이도 선택');
    expect(html).toContain('AI 대전 시작');
    const checkedInput = html.match(/<input[^>]+checked=""/g) ?? [];
    expect(checkedInput).toHaveLength(1);
    expect(checkedInput[0]).toContain('value="' + difficulty + '"');
  });

  it('keeps replay separate from explicit lobby return', () => {
    const source = readFileSync(new URL('../src/components/omok/omok-ai-client.tsx', import.meta.url), 'utf8');
    expect(source).toContain("snapshot.status !== 'finished'");
    expect(source).toContain('replayDialog.current?.showModal()');
    expect(source).toContain('onReplay={chooseReplayDifficulty}');
    expect(source).toContain('onReturn={() => router.push(\'/omok\')}');
    expect(source).toContain('onCancel={event => { if (replayPending) event.preventDefault(); }}');
    expect(source).toContain('<OmokAiModalEntry key={snapshot.id} initialDifficulty={snapshot.difficulty}');
    expect(source).not.toContain('async function again()');
  });

  it('renders an AI result replay button that offers a choice instead of a same-level rematch', () => {
    const html = renderToStaticMarkup(<OmokResultOverlay mode="ai" outcome="승리"
      onReplay={() => {}} onReturn={() => {}}/>);
    expect(html).toContain('다시하기 · 난이도 선택');
    expect(html).not.toContain('같은 난이도로 다시하기');
    expect(html).toContain('로비로 돌아가기');
  });
});
