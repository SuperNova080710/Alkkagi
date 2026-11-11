'use client';

import { createContext, type ReactNode } from 'react';

export const MatchCosmeticsContext = createContext(false);

export function MatchCosmeticsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <MatchCosmeticsContext value={enabled}>{children}</MatchCosmeticsContext>;
}
