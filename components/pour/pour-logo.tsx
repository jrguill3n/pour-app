"use client";

export function PourLogo({ size = 26, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <defs>
        <linearGradient id="plg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9f1239" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="75%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <clipPath id="plc">
          <rect x="0" y="0" width="44" height="44" rx="10" />
        </clipPath>
      </defs>
      <rect
        x="0"
        y="0"
        width="44"
        height="44"
        rx="10"
        fill={dark ? "#0f0f0f" : "#f8f7f4"}
      />
      <path
        d="M 0 22 C 11 19,33 25,44 22 L 44 44 L 0 44 Z"
        fill="url(#plg)"
        clipPath="url(#plc)"
      />
    </svg>
  );
}

export function WaveIcon({ fillPct, size = 52 }: { fillPct: number; size?: number }) {
  const f = Math.max(0, Math.min(100, fillPct));
  const y = 44 - (f / 100) * 40;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <defs>
        <linearGradient id="wig" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9f1239" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="75%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <clipPath id="wic">
          <rect x="0" y="0" width="44" height="44" rx="10" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="44" height="44" rx="10" fill="#f3f4f6" />
      <path
        d={`M 0 ${y} C 11 ${y - 3},33 ${y + 3},44 ${y} L 44 44 L 0 44 Z`}
        fill="url(#wig)"
        clipPath="url(#wic)"
        style={{ transition: "all 0.6s ease" }}
      />
    </svg>
  );
}

export function LevelBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[3px] bg-muted rounded-sm overflow-hidden">
      <div
        className="h-full rounded-sm transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
