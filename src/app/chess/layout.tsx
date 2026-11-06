import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import '@/components/chess/chess.css';

export const dynamic = 'force-dynamic';

export default function ChessLayout({children}: {children: ReactNode}) {
  if (process.env.CHESS_UI_ENABLED !== 'true') notFound();
  return children;
}
