'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isRecord, isUuid, omokErrorText, omokRequest } from './omok-client-api';
import './omok-competitive.css';

export type Difficulty = 'easy' | 'normal' | 'hard';
const options: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: '쉬움', hint: '기본 규칙과 착수를 연습합니다.' },
  { value: 'normal', label: '보통', hint: '공격과 방어를 함께 연습합니다.' },
  { value: 'hard', label: '어려움', hint: '상대의 수를 더 깊이 읽습니다.' },
];

/** Validate the server response; never invent a match ID on the client. */
export async function createOmokAiMatch(
  difficulty: Difficulty,
  request: (url: string, options: { method: 'POST'; body: { difficulty: Difficulty } }) => Promise<unknown> = omokRequest,
): Promise<string> {
  const result = await request('/api/omok/ai', { method: 'POST', body: { difficulty } });
  if (!isRecord(result) || !isUuid(result.matchId)) throw Error('AI_CREATE_INVALID');
  return result.matchId;
}

/** Starts the existing server-backed AI match without an intermediate room. */
export function OmokAiModalEntry({ onPendingChange, initialDifficulty = 'normal' }: {
  onPendingChange?: (pending: boolean) => void;
  initialDifficulty?: Difficulty;
}) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    onPendingChange?.(true);
    setError('');
    try {
      const matchId = await createOmokAiMatch(difficulty);
      router.push('/omok/ai/' + matchId);
    } catch (cause) {
      setError(omokErrorText(cause));
    } finally {
      lock.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return <form className="arena-ai-entry arena-omok-ai-dialog-entry" onSubmit={event => void start(event)}>
    <p className="arena-muted">난이도를 고르고 시작하면 바로 AI 대국으로 이동합니다. 오목 랭크 RP는 변하지 않습니다.</p>
    <fieldset className="arena-omok-difficulty" disabled={pending}>
      <legend>AI 난이도 선택</legend>
      {options.map(item => <label key={item.value} className={difficulty === item.value ? 'is-selected' : ''}>
        <input type="radio" name="omok-ai-difficulty" value={item.value}
          checked={difficulty === item.value} onChange={() => setDifficulty(item.value)}/>
        <strong>{item.label}</strong><span>{item.hint}</span>
      </label>)}
    </fieldset>
    <button type="submit" className="arena-button arena-button--blue" disabled={pending}>
      {pending ? 'AI 대국 생성 중…' : 'AI 대전 시작'}
    </button>
    {error && <p role="alert" className="arena-omok-live-error">{error}</p>}
  </form>;
}
