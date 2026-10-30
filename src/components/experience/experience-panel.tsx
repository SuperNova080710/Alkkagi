'use client';

import Link from 'next/link';
import { ArenaPanel } from '@/components/ui/arena';
import { usePlayerResource } from '@/components/players/use-player-resource';

export type ExperienceReward = {
  id: string;
  sourceKind: string;
  sourceId: string;
  outcome: string;
  earnedXp: number;
  createdAt: string;
};

export type ExperienceData = {
  userId: string;
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelCost: number;
  nextLevelAt: number;
  recentRewards: ExperienceReward[] | null;
};

export function experiencePercent(data: ExperienceData): number {
  if (!Number.isFinite(data.currentLevelXp) || !Number.isFinite(data.nextLevelCost) ||
      data.nextLevelCost <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(data.currentLevelXp / data.nextLevelCost * 100)));
}

// Network JSON is untrusted at runtime, regardless of the TypeScript generic
// used by usePlayerResource. Validate nested reward records before rendering.
function isExperienceReward(value: unknown): value is ExperienceReward {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reward = value as Partial<ExperienceReward>;
  return typeof reward.id === 'string' && reward.id.length > 0 &&
    typeof reward.sourceKind === 'string' &&
    typeof reward.sourceId === 'string' &&
    typeof reward.outcome === 'string' &&
    Number.isSafeInteger(reward.earnedXp) && reward.earnedXp! >= 0 &&
    typeof reward.createdAt === 'string' &&
    !Number.isNaN(Date.parse(reward.createdAt));
}

export function isExperienceData(data: unknown): data is ExperienceData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const xp = data as Partial<ExperienceData>;
  if (typeof xp.userId !== 'string' || xp.userId.length === 0 ||
      !Number.isSafeInteger(xp.level) || xp.level! < 1 ||
      !Number.isSafeInteger(xp.totalXp) || xp.totalXp! < 0 ||
      !Number.isSafeInteger(xp.currentLevelXp) || xp.currentLevelXp! < 0 ||
      !Number.isSafeInteger(xp.nextLevelCost) || xp.nextLevelCost! <= 0 ||
      !Number.isSafeInteger(xp.nextLevelAt) || xp.nextLevelAt! <= xp.totalXp!) return false;
  // Consistency of current interval and next cumulative goal matters too.
  if (xp.currentLevelXp! >= xp.nextLevelCost! ||
      xp.currentLevelXp! > xp.totalXp! ||
      xp.nextLevelAt! - xp.totalXp! !== xp.nextLevelCost! - xp.currentLevelXp!) return false;
  return xp.recentRewards === null ||
    (Array.isArray(xp.recentRewards) && xp.recentRewards.every(isExperienceReward));
}

const number = (value: number) => value.toLocaleString('ko-KR');
const kinds: Record<string, string> = { casual: '일반전', ranked: '랭크전', ai: 'AI 연습전' };
const outcomes: Record<string, string> = { win: '승리', loss: '패배', draw: '무승부' };

function rewardTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' :
    date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export function ExperienceSummary({ data, isSelf = false }: { data: ExperienceData; isSelf?: boolean }) {
  const progress = experiencePercent(data);
  return <div className="arena-xp">
    <div className="arena-xp-head">
      <div><span className="arena-section-kicker">PLAYER LEVEL</span>
        <strong>Lv.{number(data.level)}</strong>
        <span className="arena-xp-total">누적 {number(data.totalXp)} XP</span></div>
      <div className="arena-xp-level-mark" aria-hidden="true">{data.level}</div>
    </div>
    <div className="arena-xp-meter-label">
      <span>다음 레벨까지</span>
      <strong>{number(data.currentLevelXp)} / {number(data.nextLevelCost)} XP</strong>
    </div>
    <progress className="arena-xp-meter" max={data.nextLevelCost} value={Math.min(data.currentLevelXp, data.nextLevelCost)}
      aria-label="다음 레벨까지 경험치 진행률"
      aria-valuetext={`${progress}% 달성, ${number(data.nextLevelAt)} 누적 XP에 다음 레벨`}/>
    <p className="arena-xp-hint">Lv.{number(data.level + 1)}까지 누적 {number(data.nextLevelAt)} XP · 경험치와 랭크 RP는 별도입니다.</p>
    {isSelf && <>
      <div className="arena-xp-rewards-heading"><h3>최근 획득 기록</h3><span>최근 최대 20건</span></div>
      {data.recentRewards?.length ? <ol className="arena-xp-rewards">
        {data.recentRewards.slice(0, 20).map(reward =>
          <li key={reward.id}>
            <span className="arena-xp-reward-label"><strong>{kinds[reward.sourceKind] ?? '경기'} · {outcomes[reward.outcome] ?? '종료'}</strong>
              <time dateTime={reward.createdAt}>{rewardTime(reward.createdAt)}</time></span>
            <strong className="arena-xp-amount">{reward.earnedXp > 0 ? '+' : ''}{number(reward.earnedXp)} XP</strong>
          </li>)}
      </ol> : <p className="arena-xp-empty">아직 획득 기록이 없습니다. 경기를 마치면 여기서 확인할 수 있습니다.</p>}
    </>}
  </div>;
}

export function ExperiencePanel({ playerId }: { playerId?: string }) {
  const path = playerId
    ? `/api/experience/players/${encodeURIComponent(playerId)}`
    : '/api/experience/me';
  const { data, error, loading, retry } = usePlayerResource<ExperienceData>(path);
  return <ArenaPanel title={playerId ? '레벨 · 경험치' : '나의 레벨 · 경험치'} className="arena-xp-panel">
    {loading && <p role="status" className="arena-muted">레벨 정보를 불러오고 있습니다…</p>}
    {error != null && <div className="arena-xp-unavailable">
      {error === 401 ? <>
        <p role="alert">로그인이 만료되었습니다. 다시 로그인해 주세요.</p>
        <Link href="/login" className="arena-text-link">로그인하기 ›</Link>
      </> : <>
        <p role="status">{error === 503 ? '경험치 기능 준비 중입니다. 운영 환경이 준비되면 확인할 수 있습니다.'
          : error === 404 ? '레벨 정보를 확인할 수 없는 플레이어입니다.'
          : '레벨 정보를 불러오지 못했습니다.'}</p>
        {error !== 404 && <button type="button" className="arena-xp-retry" onClick={retry}>다시 시도</button>}
      </>}
    </div>}
    {data !== undefined && !isExperienceData(data) && <p role="status" className="arena-xp-unavailable">레벨 데이터를 확인할 수 없습니다.</p>}
    {isExperienceData(data) && <ExperienceSummary data={data} isSelf={!playerId}/>}
  </ArenaPanel>;
}
