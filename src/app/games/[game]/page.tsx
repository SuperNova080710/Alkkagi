import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArenaShell } from '@/components/ui/arena';
import { gameGuideIds, gameGuides, isGameGuideId } from '@/lib/seo/game-guides';
import { SITE_NAME, SITE_ORIGIN } from '@/lib/seo/site';
import './game-guide.css';

type PageProps = { params: Promise<{ game: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return gameGuideIds.map((game) => ({ game }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game } = await params;
  if (!isGameGuideId(game)) notFound();

  const { title, description } = gameGuides[game];
  const canonical = new URL(`/games/${game}`, SITE_ORIGIN);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', locale: 'ko_KR', title, description, url: canonical, siteName: SITE_NAME },
    twitter: { card: 'summary', title, description },
  };
}

export default async function GameGuidePage({ params }: PageProps) {
  const { game } = await params;
  if (!isGameGuideId(game)) notFound();

  const guide = gameGuides[game];
  const available = guide.flag === null || process.env[guide.flag] === 'true';
  return <ArenaShell>
    <article className="arena-guide arena-public-game">
      <nav aria-label="현재 위치">
        <ol className="arena-public-game-breadcrumb">
          <li><Link href="/">홈</Link></li>
          <li aria-current="page">{guide.name}</li>
        </ol>
      </nav>
      <header className="arena-public-game-intro arena-panel">
        <h1>{guide.name} 게임 소개</h1>
        <p>{guide.description}</p>
        {available ? <div className="arena-guide-cta">
          <Link href={guide.lobby} className="arena-button">{guide.name} 로비로 가기 <span aria-hidden="true">›</span></Link>
          <p className="arena-muted">대전에는 로그인이 필요합니다. <Link href="/signup">회원가입</Link></p>
        </div> : <p className="arena-public-game-status">현재 이 환경에서는 {guide.name} 대전을 이용할 수 없습니다.</p>}
      </header>

      <section aria-labelledby="game-guide-rules" className="arena-panel">
        <h2 id="game-guide-rules">기본 규칙과 조작</h2>
        {guide.rules.map((rule) => <p key={rule}>{rule}</p>)}
        <p>{guide.controls}</p>
        {game === 'alkkagi' && <Link href="/how-to-play">알까기 상세 규칙과 조작법</Link>}
      </section>

      <section aria-labelledby="game-guide-modes" className="arena-panel">
        <h2 id="game-guide-modes">대전 방식</h2>
        <dl className="arena-public-game-modes">
          <div><dt>친구 일반전</dt><dd>{guide.modes[0]}</dd></div>
          <div><dt>AI 연습전</dt><dd>{guide.modes[1]}</dd></div>
          <div><dt>랭크전</dt><dd>{guide.modes[2]}</dd></div>
        </dl>
      </section>

      <nav className="arena-guide-jump" aria-label="다른 게임 소개">
        {gameGuideIds.filter((id) => id !== game).map((id) =>
          <Link key={id} href={`/games/${id}`}>{gameGuides[id].name} 소개</Link>)}
      </nav>
    </article>
  </ArenaShell>;
}
