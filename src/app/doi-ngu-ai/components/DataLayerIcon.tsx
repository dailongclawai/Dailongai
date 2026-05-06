"use client";

type IconKey = "supabase" | "shared-memory" | "fleet-events" | "fleet-registry" | "entity-facts" | "rag-knowledge";

type Props = {
  icon: IconKey;
  color: string;
  size?: number;
};

export default function DataLayerIcon({ icon, color, size = 64 }: Props) {
  const filterId = `glow-${icon}`;
  const gradId = `grad-${icon}`;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        flex: "none",
      }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <g filter={`url(#${filterId})`}>
          {/* Backplate halo */}
          <circle cx="32" cy="32" r="30" fill={color} fillOpacity="0.06" stroke={color} strokeOpacity="0.18" strokeWidth="0.7" />

          {icon === "supabase" && <SupabaseIcon color={color} gradId={gradId} />}
          {icon === "shared-memory" && <BrainIcon color={color} gradId={gradId} />}
          {icon === "fleet-events" && <RadioIcon color={color} gradId={gradId} />}
          {icon === "fleet-registry" && <SatelliteIcon color={color} gradId={gradId} />}
          {icon === "entity-facts" && <ChainGraphIcon color={color} gradId={gradId} />}
          {icon === "rag-knowledge" && <KnowledgeIcon color={color} gradId={gradId} />}
        </g>
      </svg>
    </div>
  );
}

function SupabaseIcon({ color, gradId }: { color: string; gradId: string }) {
  return (
    <g stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <ellipse cx="32" cy="20" rx="14" ry="5" fill={`url(#${gradId})`} fillOpacity="0.25" />
      <path d="M18 20 v8 a14 5 0 0 0 28 0 v-8" />
      <path d="M18 30 v8 a14 5 0 0 0 28 0 v-8" />
      <path d="M18 40 v8 a14 5 0 0 0 28 0 v-8" />
      <ellipse cx="32" cy="20" rx="14" ry="5" />
      <circle cx="46" cy="50" r="2.2" fill={color} stroke="none" />
    </g>
  );
}

function BrainIcon({ color, gradId }: { color: string; gradId: string }) {
  return (
    <g stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="32" cy="32" r="14" fill={`url(#${gradId})`} fillOpacity="0.18" />
      <circle cx="32" cy="32" r="14" />
      {/* Neural nodes */}
      <circle cx="32" cy="32" r="3" fill={color} stroke="none" />
      <circle cx="22" cy="24" r="2" fill={color} stroke="none" />
      <circle cx="42" cy="24" r="2" fill={color} stroke="none" />
      <circle cx="22" cy="42" r="2" fill={color} stroke="none" />
      <circle cx="42" cy="42" r="2" fill={color} stroke="none" />
      <circle cx="32" cy="18" r="2" fill={color} stroke="none" />
      <circle cx="32" cy="46" r="2" fill={color} stroke="none" />
      {/* Connections */}
      <path d="M32 32 L22 24 M32 32 L42 24 M32 32 L22 42 M32 32 L42 42 M32 32 L32 18 M32 32 L32 46" strokeOpacity="0.55" />
    </g>
  );
}

function RadioIcon({ color, gradId }: { color: string; gradId: string }) {
  return (
    <g stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none">
      {/* Tower base */}
      <rect x="29" y="36" width="6" height="14" fill={`url(#${gradId})`} fillOpacity="0.3" />
      <path d="M26 50 L32 36 L38 50 Z" />
      <path d="M28 44 L36 44" />
      {/* Tower antenna */}
      <line x1="32" y1="36" x2="32" y2="22" />
      <circle cx="32" cy="22" r="2.5" fill={color} stroke="none" />
      {/* Signal arcs left */}
      <path d="M22 22 a 14 14 0 0 0 0 14" strokeOpacity="0.85" />
      <path d="M16 18 a 22 22 0 0 0 0 24" strokeOpacity="0.55" />
      <path d="M10 14 a 30 30 0 0 0 0 32" strokeOpacity="0.3" />
      {/* Signal arcs right */}
      <path d="M42 22 a 14 14 0 0 1 0 14" strokeOpacity="0.85" />
      <path d="M48 18 a 22 22 0 0 1 0 24" strokeOpacity="0.55" />
      <path d="M54 14 a 30 30 0 0 1 0 32" strokeOpacity="0.3" />
    </g>
  );
}

function SatelliteIcon({ color, gradId }: { color: string; gradId: string }) {
  return (
    <g stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Body */}
      <rect x="26" y="26" width="12" height="12" rx="1" fill={`url(#${gradId})`} fillOpacity="0.3" />
      <rect x="26" y="26" width="12" height="12" rx="1" />
      <line x1="29" y1="29" x2="35" y2="29" />
      <line x1="29" y1="32" x2="35" y2="32" />
      <line x1="29" y1="35" x2="33" y2="35" />
      {/* Solar panels */}
      <rect x="10" y="28" width="14" height="8" rx="0.5" />
      <line x1="14" y1="28" x2="14" y2="36" strokeOpacity="0.6" />
      <line x1="18" y1="28" x2="18" y2="36" strokeOpacity="0.6" />
      <rect x="40" y="28" width="14" height="8" rx="0.5" />
      <line x1="46" y1="28" x2="46" y2="36" strokeOpacity="0.6" />
      <line x1="50" y1="28" x2="50" y2="36" strokeOpacity="0.6" />
      {/* Antenna */}
      <line x1="32" y1="26" x2="32" y2="14" />
      <path d="M28 14 L32 10 L36 14" />
      {/* Orbit ring */}
      <ellipse cx="32" cy="32" rx="26" ry="8" strokeOpacity="0.3" strokeDasharray="2 3" />
    </g>
  );
}

function ChainGraphIcon({ color, gradId }: { color: string; gradId: string }) {
  return (
    <g stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Three nodes */}
      <circle cx="20" cy="22" r="5" fill={`url(#${gradId})`} fillOpacity="0.35" />
      <circle cx="20" cy="22" r="5" />
      <circle cx="44" cy="22" r="5" fill={`url(#${gradId})`} fillOpacity="0.35" />
      <circle cx="44" cy="22" r="5" />
      <circle cx="32" cy="44" r="5" fill={`url(#${gradId})`} fillOpacity="0.35" />
      <circle cx="32" cy="44" r="5" />
      {/* Inner dots */}
      <circle cx="20" cy="22" r="1.5" fill={color} stroke="none" />
      <circle cx="44" cy="22" r="1.5" fill={color} stroke="none" />
      <circle cx="32" cy="44" r="1.5" fill={color} stroke="none" />
      {/* Connections (edges) */}
      <line x1="25" y1="22" x2="39" y2="22" strokeOpacity="0.7" />
      <line x1="22" y1="27" x2="30" y2="40" strokeOpacity="0.7" />
      <line x1="42" y1="27" x2="34" y2="40" strokeOpacity="0.7" />
      {/* Tiny orbit dots on edges */}
      <circle cx="32" cy="22" r="1" fill={color} stroke="none" opacity="0.7" />
      <circle cx="26" cy="33.5" r="1" fill={color} stroke="none" opacity="0.7" />
      <circle cx="38" cy="33.5" r="1" fill={color} stroke="none" opacity="0.7" />
    </g>
  );
}

function KnowledgeIcon({ color, gradId }: { color: string; gradId: string }) {
  return (
    <g stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Open book */}
      <path d="M10 22 L32 18 L54 22 L54 48 L32 44 L10 48 Z" fill={`url(#${gradId})`} fillOpacity="0.18" />
      <path d="M10 22 L32 18 L54 22 L54 48 L32 44 L10 48 Z" />
      <line x1="32" y1="18" x2="32" y2="44" />
      {/* Page lines left */}
      <line x1="15" y1="28" x2="28" y2="26" strokeOpacity="0.6" />
      <line x1="15" y1="33" x2="28" y2="31" strokeOpacity="0.6" />
      <line x1="15" y1="38" x2="28" y2="36" strokeOpacity="0.6" />
      {/* Page lines right */}
      <line x1="36" y1="26" x2="49" y2="28" strokeOpacity="0.6" />
      <line x1="36" y1="31" x2="49" y2="33" strokeOpacity="0.6" />
      <line x1="36" y1="36" x2="49" y2="38" strokeOpacity="0.6" />
      {/* Floating data dots above */}
      <circle cx="22" cy="10" r="1.2" fill={color} stroke="none" />
      <circle cx="32" cy="7" r="1.4" fill={color} stroke="none" />
      <circle cx="42" cy="10" r="1.2" fill={color} stroke="none" />
      <line x1="22" y1="10" x2="32" y2="7" strokeOpacity="0.4" />
      <line x1="32" y1="7" x2="42" y2="10" strokeOpacity="0.4" />
    </g>
  );
}
