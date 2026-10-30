import type { Metadata } from 'next';
import Link from 'next/link';
import { ArenaHero, ArenaModeCard, ArenaShell } from '@/components/ui/arena';

// Keep the homepage canonical local; the public how-to guide has its own canonical.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return <ArenaShell account={<Link href="/login" className="arena-login-link">로그인</Link>}>
    <ArenaHero />
    <section className="arena-home-intro" aria-label="게임 소개">
      <div><p className="arena-section-kicker">설치 없이, 브라우저에서</p><h2>알 다섯 개로 시작하는<br className="arena-mobile-break" /> 우리들의 한 판.</h2><p>방향을 잡고, 힘을 조절하고, 상대의 알을 밀어내세요.</p></div>
      <div className="arena-home-actions"><Link href="/lobby" className="arena-button">게임하러 가기 <span aria-hidden="true">›</span></Link><Link href="/signup" className="arena-button arena-button--outline">회원가입</Link></div>
    </section>
    <div className="arena-modes arena-home-modes">
      <ArenaModeCard mode="casual"><Link href="/lobby" className="arena-button">친구와 한 판 <span aria-hidden="true">›</span></Link></ArenaModeCard>
      <ArenaModeCard mode="ranked"><Link href="/ranked" className="arena-button arena-button--gold">랭크 아레나 <span aria-hidden="true">›</span></Link></ArenaModeCard>
      <ArenaModeCard mode="ai"><Link href="/lobby" className="arena-button arena-button--blue">AI와 연습하기 <span aria-hidden="true">›</span></Link></ArenaModeCard>
    </div>
    <p className="arena-home-note">로그인 후 일반전·랭크전·AI 연습전을 즐길 수 있습니다. <Link href="/how-to-play" className="arena-home-guide-link">알까기 규칙과 조작법 보기 <span aria-hidden="true">›</span></Link></p>
  </ArenaShell>;
}
