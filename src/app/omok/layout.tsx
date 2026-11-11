import type { ReactNode } from 'react';
import { MatchCosmeticsProvider } from '@/components/cosmetics/match-cosmetics-provider';

export default function OmokLayout({children}: {children: ReactNode}) {
  return <MatchCosmeticsProvider enabled={process.env.COSMETICS_UI_ENABLED === 'true'}>{children}</MatchCosmeticsProvider>;
}
