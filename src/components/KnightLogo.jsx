import React from "react";
import { useTheme } from "../theme.js";

export default function KnightLogo({ size = 64 }) {
  const C = useTheme();
  const h = size * (72 / 64);
  return (
    <svg width={size} height={h} viewBox="0 0 64 72" fill="none" style={{
      opacity: 0.85, flexShrink: 0,
      filter: "drop-shadow(0 2px 8px rgba(201,168,76,0.15))",
    }}>
      <path d="M32 2L4 14V38C4 52 16 64 32 70C48 64 60 52 60 38V14L32 2Z"
        fill="#1a1814" stroke={C.gold} strokeWidth="1.5" />
      <path d="M32 7L9 17V37C9 49 19 59 32 65C45 59 55 49 55 37V17L32 7Z"
        fill="#111" stroke={C.goldDim} strokeWidth="0.5" />
      <path d="M22 28C22 20 26 15 32 13C38 15 42 20 42 28V36H22V28Z"
        fill={C.gold} opacity="0.9" />
      <path d="M25 26L32 33L39 26" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 36V42C22 44 24 46 26 46H38C40 46 42 44 42 42V36"
        fill={C.goldMuted} stroke={C.gold} strokeWidth="0.5" />
      <line x1="28" y1="36" x2="28" y2="46" stroke="#111" strokeWidth="1" opacity="0.4" />
      <line x1="32" y1="36" x2="32" y2="46" stroke="#111" strokeWidth="1" opacity="0.4" />
      <line x1="36" y1="36" x2="36" y2="46" stroke="#111" strokeWidth="1" opacity="0.4" />
      <line x1="6" y1="56" x2="26" y2="20" stroke={C.goldDim} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="58" y1="56" x2="38" y2="20" stroke={C.goldDim} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

