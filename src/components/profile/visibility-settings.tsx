'use client';
import { useRef, useState } from 'react';
import type { PlayerVisibilitySettings } from '@/lib/players/validation';
import { ArenaPanel } from '@/components/ui/arena';
import { PlayerFeedback } from '@/components/players/player-feedback';
import { PlayerRequestError, playerRequest, usePlayerResource } from '@/components/players/use-player-resource';
export function VisibilitySettings() {
  const { data, error, loading, retry } = usePlayerResource<{ settings: PlayerVisibilitySettings }>('/api/players/me');
  return <ArenaPanel title="프로필 공개 설정" className="arena-directory-panel">
    <p className="arena-muted">플레이어 검색과 공개 프로필에 적용됩니다. 기존 랭크 순위표·대전 화면·경기 기록의 닉네임과 RP는 계속 표시됩니다.</p>
    {loading && <p role="status">공개 설정을 불러오고 있어요…</p>}
    {error ? <PlayerFeedback status={error} retry={retry}/> : null}
    {data && <VisibilityEditor initial={data.settings}/>}
  </ArenaPanel>;
}
function VisibilityEditor({ initial }: { initial: PlayerVisibilitySettings }) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<number>();
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const changed = value.discoverable !== saved.discoverable || value.showRankedStats !== saved.showRankedStats;
  async function save() {
    if (busy.current || !changed) return;
    busy.current = true; setPending(true); setError(undefined); setMessage('');
    try {
      const result = await playerRequest<PlayerVisibilitySettings>('/api/players/me/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      setSaved(result); setValue(result); setMessage('공개 설정을 저장했습니다.');
    } catch (cause) { setError(cause instanceof PlayerRequestError ? cause.status : 503); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); void save(); }}>
    <fieldset disabled={pending || error === 401} className="arena-visibility-options"><legend className="sr-only">공개 범위 선택</legend>
      <label><input type="checkbox" checked={value.discoverable} onChange={event => { setValue({ ...value, discoverable: event.target.checked }); setMessage(''); }}/><span><strong>플레이어 검색·프로필 공개</strong><small>끄면 다른 플레이어의 검색과 프로필 상세 조회에서 숨겨집니다.</small></span></label>
      <label><input type="checkbox" checked={value.showRankedStats} onChange={event => { setValue({ ...value, showRankedStats: event.target.checked }); setMessage(''); }}/><span><strong>프로필의 랭크 전적 공개</strong><small>RP·순위·승패 기록을 공개합니다. 본인은 설정과 관계없이 확인할 수 있습니다.</small></span></label>
    </fieldset>
    {!value.discoverable && <p className="arena-muted">프로필이 비공개인 동안 전적도 다른 사람에게 보이지 않습니다. 전적 공개 선택은 프로필을 다시 공개할 때 적용됩니다.</p>}
    <button className="arena-button" type="submit" disabled={!changed || pending || error === 401}>{pending ? '저장 중…' : '공개 설정 저장'}</button>
    <p role="status">{message || (changed && !error ? '아직 저장하지 않은 변경이 있습니다.' : '')}</p>
    {error ? <PlayerFeedback status={error} retry={() => { void save(); }}/> : null}
  </form>;
}
