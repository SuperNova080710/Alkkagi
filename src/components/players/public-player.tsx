'use client';
import Link from 'next/link';
import { ArenaPanel } from '@/components/ui/arena';
import { PlayerFeedback } from './player-feedback';
import { usePlayerResource } from './use-player-resource';
export type PublicPlayer = { id: string; nickname: string; isSelf: boolean; ranked: null | { rating: number; rank: number; wins: number; losses: number; draws: number; matches: number } };
export function PublicPlayer({ id }: { id: string }) {
  const { data, error, loading, retry } = usePlayerResource<PublicPlayer>(`/api/players/${encodeURIComponent(id)}`);
  return <>
    {loading && <p role="status" className="arena-directory-status">프로필을 불러오고 있어요…</p>}
    {error ? <PlayerFeedback status={error} retry={retry}/> : null}
    {data && <><ArenaPanel title="플레이어"><div className="arena-public-name"><span className="arena-player-mark" aria-hidden="true">●</span><h2>{data.nickname}</h2>{data.isSelf && <span>내 프로필</span>}</div>
      {data.isSelf && <Link href="/profile" className="arena-text-link">닉네임·공개 설정 관리 ›</Link>}</ArenaPanel>
      {data.ranked ? <div className="arena-stats"><ArenaPanel title="현재 RP"><p>{data.ranked.rating.toLocaleString('ko-KR')}<small> RP</small></p></ArenaPanel><ArenaPanel title="전체 순위"><p>{data.ranked.rank > 0 ? `#${data.ranked.rank}` : '—'}</p></ArenaPanel><ArenaPanel title="랭크 전적"><p>{data.ranked.wins}승 · {data.ranked.losses}패 · {data.ranked.draws}무</p><span>총 {data.ranked.matches}경기</span></ArenaPanel></div>
      : <ArenaPanel title="랭크 전적"><p>이 플레이어는 프로필의 랭크 전적을 공개하지 않았습니다.</p></ArenaPanel>}
    </>}
    <Link href="/players" className="arena-text-link">플레이어 검색으로 돌아가기 ›</Link>
  </>;
}
