'use client';

import { useId, useState, type ReactNode } from 'react';
import type { ChessDifficulty } from '@/lib/chess/ai';
import '@/components/omok/omok-competitive.css';

export const chessDifficultyLabels = { easy: '쉬움', normal: '보통', hard: '어려움' } as const;
const hints = {
  easy: '기본 기물 이동을 연습합니다.',
  normal: '공격과 방어를 함께 연습합니다.',
  hard: '상대의 수를 더 깊이 읽습니다.',
};

export function ChessDifficultyForm({ onStart, initial = 'normal', children }: {
  onStart: (difficulty: ChessDifficulty) => void;
  initial?: ChessDifficulty;
  children?: ReactNode;
}) {
  const name = useId();
  const [difficulty, setDifficulty] = useState(initial);
  return <form className="arena-ai-entry arena-omok-ai-dialog-entry" onSubmit={event => {
    event.preventDefault();
    onStart(difficulty);
  }}>
    <p className="arena-muted">난이도를 고르고 시작하면 바로 AI 대국으로 이동합니다. 랭크 RP는 변하지 않습니다.</p>
    <fieldset className="arena-omok-difficulty">
      <legend>AI 난이도 선택</legend>
      {(Object.keys(chessDifficultyLabels) as ChessDifficulty[]).map(level =>
        <label key={level} className={difficulty === level ? 'is-selected' : ''}>
          <input type="radio" name={name} value={level} checked={difficulty === level}
            onChange={() => setDifficulty(level)}/>
          <strong>{chessDifficultyLabels[level]}</strong><span>{hints[level]}</span>
        </label>)}
    </fieldset>
    <button type="submit" className="arena-button arena-button--blue">AI 대국 시작</button>
    {children}
  </form>;
}
