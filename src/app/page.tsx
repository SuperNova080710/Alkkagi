import type { Metadata } from 'next';
import { SITE_NAME, SITE_NAME_EN, SITE_ORIGIN, SITE_TITLE } from '@/lib/seo/site';
import Link from 'next/link';
import { ArenaHomeShell as ArenaShell } from '@/components/ui/arena';
import { HomeGameSelection } from '@/components/lobby/home-game-selection';
import './home-platform.css';

// Keep the homepage canonical local; the public how-to guide has its own canonical.
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: '/' },
};

const websiteJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: SITE_NAME_EN,
  url: new URL('/', SITE_ORIGIN).href,
}).replace(/</g, '\\u003c');

function HomeContent() {
  return <ArenaShell account={<Link href="/login" className="arena-login-link">로그인</Link>}>
    <HomeGameSelection />
    <p className="arena-home-note">로그인 후 일반전·랭크전·AI 연습전을 즐길 수 있습니다. <Link href="/how-to-play" className="arena-home-guide-link">알까기 규칙과 조작법 보기 <span aria-hidden="true">›</span></Link></p>
  </ArenaShell>;
}

export default function Home() {
  return <>
    <HomeContent />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />
  </>;
}
