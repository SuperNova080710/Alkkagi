import { useId } from 'react';

/** Decoration only. The 800×500 play area and all piece/shot coordinates stay unchanged. */
export function CourtSurface() {
  const id = useId();
  return <g pointerEvents="none" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#925f39"/><stop offset=".5" stopColor="#a5744a"/><stop offset="1" stopColor="#794a2d"/>
    </linearGradient></defs>
    <rect width="800" height="500" fill={`url(#${id})`}/>
    <path d="M0 100H800 M0 200H800 M0 300H800 M0 400H800" stroke="#57351f" strokeOpacity=".16" strokeWidth="2"/>
    <rect x="23" y="23" width="754" height="454" rx="6" fill="none" stroke="#f8dfb0" strokeOpacity=".42" strokeWidth="2"/>
    <path d="M400 24V476" stroke="#f8dfb0" strokeOpacity=".25" strokeDasharray="8 10" strokeWidth="2"/>
    <circle cx="400" cy="250" r="55" fill="none" stroke="#f8dfb0" strokeOpacity=".2" strokeWidth="2"/>
  </g>;
}
