import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/user';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
import { CosmeticWardrobe } from '@/components/cosmetics/cosmetic-wardrobe';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: '게임 외형 꾸미기',
  robots: { index: false, follow: false },
};

export default async function CosmeticsPage() {
  await requireUser();
  const enabled = process.env.COSMETICS_UI_ENABLED === 'true';
  return <ArenaShell current="cosmetics">
    <div className="arena-service arena-cosmetics-page">
      <header className="arena-service-heading">
        <div>
          <p className="arena-section-kicker">MY COLLECTION · COSMETICS</p>
          <h1>게임 외형 꾸미기</h1>
          <p>알까기 알, 캐릭터, 오목돌, 체스 기물의 외형을 고르세요.</p>
        </div>
        <Link href="/profile" className="arena-button arena-button--outline">내 프로필</Link>
      </header>
      {enabled ? <CosmeticWardrobe/> :
        <ArenaPanel title="꾸미기 기능 준비 중">
          <p>운영 환경과 아이템 데이터 검증이 끝나면 꾸미기 기능을 이용할 수 있습니다.</p>
          <Link href="/profile" className="arena-text-link">내 프로필로 돌아가기 ›</Link>
        </ArenaPanel>}
    </div>
  </ArenaShell>;
}
