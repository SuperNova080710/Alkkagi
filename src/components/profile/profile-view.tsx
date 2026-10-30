import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
export function ProfileView({ profile, editor, settings, unavailableReason = 'query-error' }: { profile: { nickname: string; rating: number } | null; editor?: ReactNode; settings?: ReactNode; unavailableReason?: 'query-error' | 'missing' }) {
  return <ArenaShell current="profile"><div className="arena-service arena-profile">
    <header className="arena-service-heading"><div><p className="arena-section-kicker">MY ARENA</p><h1>나의 알까기</h1><p>친구들이 기억할 이름, 나만의 한 판.</p></div><Image src="/art/casual.webp" alt="" width={150} height={150}/></header>
    {profile ? <div className="arena-profile-grid"><div className="arena-profile-main"><ArenaPanel title="플레이어 정보"><div className="arena-profile-summary"><div><p className="arena-muted">현재 닉네임</p><strong>{profile.nickname}</strong></div><div><p className="arena-muted">현재 RP</p><strong>{profile.rating.toLocaleString('ko-KR')}<small> RP</small></strong></div></div><Link href="/ranked" className="arena-text-link">랭킹과 전적 보기 <span aria-hidden="true">›</span></Link></ArenaPanel>
      <div className="arena-service-controls">{editor}</div>
      <p className="arena-profile-help">닉네임은 대전 화면, 턴 기록, 랭크 순위표와 경기 기록에 표시됩니다.</p>
      </div><div className="arena-profile-aside">{settings}</div></div>
    : <ArenaPanel title="프로필을 확인해 주세요"><p role="alert">{unavailableReason === 'missing'
        ? '계정에 연결된 프로필 정보가 없습니다. 다시 확인해도 같은 화면이 나오면 계정 데이터 확인이 필요합니다.'
        : '프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}</p>
      <form action="/profile" method="get" className="mt-4"><button type="submit" className="arena-button">프로필 다시 조회</button></form>
      <Link href="/lobby" className="arena-text-link">로비로 돌아가기 <span aria-hidden="true">›</span></Link></ArenaPanel>}
    <section className="arena-profile-future" aria-labelledby="future-title"><h2 id="future-title">앞으로 만날 기능</h2><p>친구 · 메신저 · 경험치와 레벨 · 알과 캐릭터 꾸미기</p><span>준비 중</span></section>
  </div></ArenaShell>;
}
