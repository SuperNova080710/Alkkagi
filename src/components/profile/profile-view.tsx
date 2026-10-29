import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArenaPanel, ArenaShell } from '@/components/ui/arena';
export function ProfileView({ profile, editor }: { profile: { nickname: string; rating: number } | null; editor?: ReactNode }) {
  return <ArenaShell current="profile"><div className="arena-service arena-profile">
    <header className="arena-service-heading"><div><p className="arena-section-kicker">MY ARENA</p><h1>나의 알까기</h1><p>친구들이 기억할 이름, 나만의 한 판.</p></div><Image src="/art/casual.webp" alt="" width={150} height={150}/></header>
    {profile ? <><ArenaPanel title="플레이어 정보"><div className="arena-profile-summary"><div><p className="arena-muted">현재 닉네임</p><strong>{profile.nickname}</strong></div><div><p className="arena-muted">현재 RP</p><strong>{profile.rating.toLocaleString('ko-KR')}<small> RP</small></strong></div></div><Link href="/ranked" className="arena-text-link">랭킹과 전적 보기 <span aria-hidden="true">›</span></Link></ArenaPanel>
      <div className="arena-service-controls">{editor}</div>
      <p className="arena-profile-help">닉네임은 대전 화면, 턴 기록, 랭크 순위표와 경기 기록에 표시됩니다.</p>
    </> : <ArenaPanel title="프로필을 확인해 주세요"><p role="alert">프로필을 불러오지 못했습니다. 다시 로그인해 주세요.</p><Link href="/login" className="arena-text-link">로그인 화면으로 <span aria-hidden="true">›</span></Link></ArenaPanel>}
    <section className="arena-profile-future" aria-labelledby="future-title"><h2 id="future-title">앞으로 만날 기능</h2><p>친구 · 메신저 · 경험치와 레벨 · 알과 캐릭터 꾸미기</p><span>준비 중</span></section>
  </div></ArenaShell>;
}
