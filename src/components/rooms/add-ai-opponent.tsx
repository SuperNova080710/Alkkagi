'use client';
import { useActionState } from 'react';
import { addAiOpponent } from '@/app/rooms/ai-actions';
import { AI_DIFFICULTIES, DIFFICULTY_LABELS } from '@/lib/ai/bot';

export function AddAiOpponent({ roomId }: { roomId: string }) {
  const [state, action, pending] = useActionState(addAiOpponent, { error: '' });
  return <form action={action} className="arena-room-ai-card">
    <div className="arena-room-ai-heading">
      <span aria-hidden="true">●</span><div><h3>AI 상대 추가</h3>
        <p>친구를 기다리는 대신 AI와 연습할 수 있습니다. 랭크 RP에는 반영되지 않습니다.</p>
      </div>
    </div>
    <input type="hidden" name="roomId" value={roomId}/>
    <fieldset>
      <legend>AI 난이도</legend>
      <div className="arena-room-ai-levels">
        {AI_DIFFICULTIES.map(difficulty =>
          <label key={difficulty}>
            <input type="radio" name="difficulty" value={difficulty}
              defaultChecked={difficulty === 'normal'}/>
            <span>{DIFFICULTY_LABELS[difficulty]}</span>
          </label>)}
      </div>
    </fieldset>
    <button type="submit" disabled={pending} className="arena-button arena-button--blue">
      {pending ? 'AI 대전 준비 중…' : 'AI 대전 시작'}
    </button>
    {state.error && <p role="alert" className="arena-invite-error">{state.error}</p>}
  </form>;
}
