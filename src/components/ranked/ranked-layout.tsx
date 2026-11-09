import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './ranked-presentation.css';

export function RankedLayout({ nickname, label, kicker, description, error, stats, queue, children }: {
  nickname: string;
  label?: string;
  kicker: string;
  description: ReactNode;
  error?: string;
  stats: ReactNode;
  queue: ReactNode;
  children: ReactNode;
}) {
  return <div className="arena-ranked-view" aria-label={label}>
    <header className="arena-service-heading">
      <div>
        <p className="arena-section-kicker">{kicker}</p>
        <h1>한 판씩, 더 높은 곳으로.</h1>
        <p>{description}</p>
      </div>
      <Image src="/art/ranked.webp" width={150} height={150} alt=""/>
    </header>
    <div className="arena-service-name">
      <strong>{nickname}</strong>
      <Link href="/profile">내 프로필 <span aria-hidden="true">›</span></Link>
    </div>
    {error && <p className="arena-service-alert" role="alert">{error}</p>}
    <div className="arena-stats">{stats}</div>
    <div className="arena-ranked-main">
      <div className="arena-service-controls">{queue}</div>
      <div className="arena-ranking-grid">{children}</div>
    </div>
  </div>;
}

export function RankedLeaderboard({ rows, caption, rpLabel = 'RP', showRecords = false, emptyMessage }: {
  rows: readonly { position: number; nickname: string; rating: number; record?: string }[];
  caption: string;
  rpLabel?: string;
  showRecords?: boolean;
  emptyMessage?: string;
}) {
  return <>
    <div className="arena-table-scroll arena-ranked-leaderboard-scroll">
      <table className="arena-ranked-leaderboard">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>
          <th scope="col">순위</th>
          <th scope="col">{showRecords ? '닉네임 · 전적' : '닉네임'}</th>
          <th scope="col">{rpLabel}</th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.position}>
          <td><span className="arena-rank-number">{row.position}</span></td>
          <td>
            <span className="arena-ranked-nickname">{row.nickname}</span>
            {row.record && <small className="arena-ranked-record">{row.record}</small>}
          </td>
          <td>{row.rating.toLocaleString('ko-KR')}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {rows.length === 0 && emptyMessage && <p className="arena-muted">{emptyMessage}</p>}
  </>;
}
