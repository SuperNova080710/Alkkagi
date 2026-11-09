import { useId } from 'react';

export function RankedQueuePanel({ status, pending, error, loading, onChange, onRefresh }: {
  status: 'idle' | 'queued' | 'matched';
  pending: boolean;
  error?: string;
  loading?: boolean;
  onChange: (intent: 'join' | 'cancel') => void;
  onRefresh?: () => void;
}) {
  const headingId = useId();
  const queued = status === 'queued';
  const matched = status === 'matched';
  return <section className="arena-ranked-queue" aria-labelledby={headingId}>
    <h2 id={headingId}>랜덤 랭크 매칭</h2>
    {loading && <p role="status">랭크 정보를 조회하는 중…</p>}
    <p className="arena-muted" role="status">
      {queued ? '비슷한 RP의 상대를 찾고 있습니다.'
        : matched ? '대전 상대를 찾았습니다. 경기로 이동합니다.'
          : '랭크 매칭을 시작하면 비슷한 RP의 상대와 대전합니다.'}
    </p>
    {error && <p role="alert" className="arena-service-alert">{error}</p>}
    <div className="arena-ranked-actions">
      <button type="button" className={`arena-button arena-button--${queued ? 'outline' : 'gold'}`}
        disabled={pending || matched} onClick={() => onChange(queued ? 'cancel' : 'join')}>
        {pending ? queued ? '취소 중…' : '처리 중…'
          : matched ? '이동 중…' : queued ? '매칭 취소' : '랭크 매칭 시작'}
      </button>
      {onRefresh && <button type="button" className="arena-button arena-button--outline"
        disabled={pending} onClick={onRefresh}>최신 상태 조회</button>}
    </div>
    <p className="arena-muted">45초 동안 대기 상태가 갱신되지 않으면 매칭이 만료될 수 있습니다.
      취소해도 RP는 변경되지 않습니다.</p>
  </section>;
}
