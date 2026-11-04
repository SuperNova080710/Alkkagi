import type { ReactNode } from 'react';
import './lobby-recovery-inline.css';

/** Compact recovery navigation; an empty lobby has no additional panel. */
export function LobbyRecoveryInline({ hasMatches, unavailable, children }: {
  hasMatches: boolean;
  unavailable: boolean;
  children?: ReactNode;
}) {
  if (!hasMatches && !unavailable) return null;
  return <nav className="arena-recovery-inline" aria-label="진행 중인 경기 이어하기">
    <strong className="arena-recovery-inline-title">이어하기</strong>
    {hasMatches && <div className="arena-recovery-inline-links">{children}</div>}
    {unavailable && <p className="arena-recovery-inline-notice" role="status">
      진행 중인 경기 일부를 불러오지 못했습니다. 새로고침 후 확인해 주세요.
    </p>}
  </nav>;
}
