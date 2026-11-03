'use client';

import { experiencePercent, isExperienceData } from '@/components/experience/experience-panel';
import { usePlayerResource } from '@/components/players/use-player-resource';

/** Compact, read-only progress; reward history remains on the personal profile. */
export function LobbyExperienceMini() {
  const { data, error, loading } = usePlayerResource<unknown>('/api/experience/me');

  if (loading) {
    return <p className="arena-lobby-xp-state" role="status">레벨 확인 중…</p>;
  }
  if (error != null || !isExperienceData(data)) {
    return <p className="arena-lobby-xp-state" role="status">레벨 정보 확인 불가</p>;
  }

  const total = data.totalXp.toLocaleString('ko-KR');
  const current = data.currentLevelXp.toLocaleString('ko-KR');
  const cost = data.nextLevelCost.toLocaleString('ko-KR');
  const percent = experiencePercent(data);

  return <div className="arena-lobby-xp-mini" aria-label="내 레벨과 경험치">
    <div className="arena-lobby-xp-heading">
      <strong>Lv.{data.level.toLocaleString('ko-KR')}</strong>
      <span>누적 {total} XP</span>
    </div>
    <div className="arena-lobby-xp-progress">
      <progress value={data.currentLevelXp} max={data.nextLevelCost}
        aria-label="다음 레벨까지 경험치 진행률"
        aria-valuetext={`${percent}% 달성, 다음 레벨까지 ${current} / ${cost} XP`}/>
      <span aria-hidden="true">{current}/{cost}</span>
    </div>
  </div>;
}
