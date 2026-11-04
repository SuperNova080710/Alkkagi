import type { ReactNode } from 'react';

/** Shared light-theme ranked/lobby panel; safe in server and client components. */
export function ArenaPanel({ title, children, className = '' }: {
  title: string; children: ReactNode; className?: string;
}) {
  return <section className={`arena-panel ${className}`}><h2>{title}</h2>{children}</section>;
}
