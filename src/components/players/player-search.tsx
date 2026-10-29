'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArenaPanel } from '@/components/ui/arena';
import { playerSearchQuery } from '@/lib/players/validation';
import { PlayerFeedback } from './player-feedback';
import { usePlayerResource } from './use-player-resource';
export function PlayerSearch() {
  const [input, setInput] = useState('');
  const [composing, setComposing] = useState(false);
  const query = composing ? null : playerSearchQuery(input);
  const { data, error, loading, retry } = usePlayerResource<{ id: string; nickname: string }[]>(query ? `/api/players/search?q=${encodeURIComponent(query)}&limit=20` : null, 300);
  return <ArenaPanel title="닉네임으로 찾기" className="arena-directory-panel">
    <label htmlFor="player-search">플레이어 닉네임</label>
    <input id="player-search" type="search" autoComplete="off" maxLength={24} value={input} onChange={event => setInput(event.target.value)} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} aria-describedby="search-guide" placeholder="찾고 싶은 닉네임을 입력하세요"/>
    <p id="search-guide" className="arena-muted">한글·영문·숫자·밑줄(_) 2~24자. 검색 공개를 허용한 플레이어만 표시됩니다.</p>
    <div aria-live="polite" aria-atomic="true"><p className="arena-directory-status">{!query ? '닉네임을 2자 이상 입력해 주세요.' : loading ? '플레이어를 찾고 있어요…' : data?.length ? `${data.length}명의 플레이어를 찾았습니다.` : data ? '검색 결과가 없습니다. 다른 닉네임을 입력해 보세요.' : ''}</p></div>
    {error ? <PlayerFeedback status={error} retry={retry}/> : null}
    <ul className="arena-player-list">{data?.map(player => <li key={player.id}><Link href={`/players/${player.id}`}><span className="arena-player-mark" aria-hidden="true">●</span><strong>{player.nickname}</strong><span>프로필 보기 ›</span></Link></li>)}</ul>
    {data?.length === 20 && <p className="arena-muted">최대 20명까지 표시합니다. 닉네임을 더 입력하면 결과를 좁힐 수 있어요.</p>}
  </ArenaPanel>;
}
