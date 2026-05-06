"use client";

type Props = { size?: number };

export default function BossEmblem({ size = 180 }: Props) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="boss-emblem-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff9069" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#ff7948" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#591800" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="boss-gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd194" />
          <stop offset="40%" stopColor="#ff9069" />
          <stop offset="100%" stopColor="#ff5a1f" />
        </linearGradient>
        <linearGradient id="boss-shield-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffb27a" />
          <stop offset="60%" stopColor="#ff9069" />
          <stop offset="100%" stopColor="#c04a1a" />
        </linearGradient>
        <filter id="boss-emblem-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer aura */}
      <circle cx="100" cy="100" r="95" fill="url(#boss-emblem-glow)" />

      {/* Hexagon frame */}
      <g transform="translate(100 100)" filter="url(#boss-emblem-blur)">
        <polygon
          points="0,-82 71,-41 71,41 0,82 -71,41 -71,-41"
          fill="none"
          stroke="#ff9069"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />
        <polygon
          points="0,-72 62,-36 62,36 0,72 -62,36 -62,-36"
          fill="rgba(255, 144, 105, 0.06)"
          stroke="#ff9069"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />

        {/* Crown — 5 spikes */}
        <path
          d="M -42,-22 L -32,-46 L -22,-26 L -12,-52 L 0,-30 L 12,-52 L 22,-26 L 32,-46 L 42,-22 L 38,-14 L -38,-14 Z"
          fill="url(#boss-gold)"
          stroke="#591800"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Crown gem highlights */}
        <circle cx="-32" cy="-46" r="2.5" fill="#fff5e6" />
        <circle cx="-12" cy="-52" r="2.8" fill="#fff5e6" />
        <circle cx="0" cy="-30" r="3.2" fill="#fff5e6" />
        <circle cx="12" cy="-52" r="2.8" fill="#fff5e6" />
        <circle cx="32" cy="-46" r="2.5" fill="#fff5e6" />

        {/* Crown band */}
        <rect x="-38" y="-14" width="76" height="6" fill="url(#boss-gold)" stroke="#591800" strokeWidth="0.8" />
        <circle cx="-22" cy="-11" r="1.5" fill="#fff5e6" />
        <circle cx="0" cy="-11" r="1.8" fill="#fff5e6" />
        <circle cx="22" cy="-11" r="1.5" fill="#fff5e6" />

        {/* Shield body */}
        <path
          d="M -36,-4 L 36,-4 L 36,22 Q 36,42 18,55 L 0,64 L -18,55 Q -36,42 -36,22 Z"
          fill="url(#boss-shield-fill)"
          stroke="#591800"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* Inner shield bevel */}
        <path
          d="M -30,-1 L 30,-1 L 30,22 Q 30,38 16,49 L 0,57 L -16,49 Q -30,38 -30,22 Z"
          fill="none"
          stroke="rgba(255, 245, 230, 0.4)"
          strokeWidth="0.8"
        />

        {/* "B" letter */}
        <text
          x="0"
          y="38"
          textAnchor="middle"
          fontSize="42"
          fontWeight="900"
          fill="#3a0d00"
          fontFamily="Manrope, Arial, sans-serif"
          style={{ letterSpacing: "-0.02em" }}
        >
          B
        </text>

        {/* Tier label */}
        <text
          x="0"
          y="58"
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill="#3a0d00"
          fontFamily="Inter, Arial, sans-serif"
          style={{ letterSpacing: "0.3em" }}
        >
          TIER · I
        </text>

        {/* Side flourishes (lightning marks) */}
        <path d="M -82,0 L -68,-6 L -72,0 L -68,6 Z" fill="#ff9069" opacity="0.7" />
        <path d="M 82,0 L 68,-6 L 72,0 L 68,6 Z" fill="#ff9069" opacity="0.7" />
      </g>

      {/* Corner brackets — HUD feel */}
      <g stroke="#ff9069" strokeWidth="1.5" fill="none" opacity="0.55">
        <path d="M 18,18 L 8,18 L 8,28" />
        <path d="M 182,18 L 192,18 L 192,28" />
        <path d="M 18,182 L 8,182 L 8,172" />
        <path d="M 182,182 L 192,182 L 192,172" />
      </g>
    </svg>
  );
}
