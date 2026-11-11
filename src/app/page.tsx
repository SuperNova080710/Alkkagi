import type { Metadata } from 'next';
import Link from 'next/link';
import { ArenaHomeShell as ArenaShell } from '@/components/ui/arena';
import { HomeGameSelection } from '@/components/lobby/home-game-selection';
import './home-platform.css';

// Keep the homepage canonical local; the public how-to guide has its own canonical.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return <ArenaShell account={<Link href="/login" className="arena-login-link">로그인</Link>}>
    <HomeGameSelection />
    <p className="arena-home-note">로그인 후 일반전·랭크전·AI 연습전을 즐길 수 있습니다. <Link href="/how-to-play" className="arena-home-guide-link">알까기 규칙과 조작법 보기 <span aria-hidden="true">›</span></Link></p>
  </ArenaShell>;
}
