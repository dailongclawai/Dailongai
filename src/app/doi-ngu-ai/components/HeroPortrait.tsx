"use client";

import { allMembers } from "../data/agents";

const FEATURED_FOR_HALO = allMembers.slice(0, 12);

export default function HeroPortrait() {
  return (
    <div className="relative w-full h-full">
      <div
        className="relative w-full h-full rounded-full overflow-hidden"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(255,144,105,0.35), transparent 60%), radial-gradient(circle at 70% 70%, rgba(0,242,255,0.25), transparent 60%), #0C0C0C",
          boxShadow: "0 0 80px rgba(255,144,105,0.4), 0 0 120px rgba(0,242,255,0.2)",
        }}
      >
        {FEATURED_FOR_HALO.map((sen, i) => {
          const angle = (i / FEATURED_FOR_HALO.length) * Math.PI * 2 - Math.PI / 2;
          const radiusPct = 38;
          const x = 50 + Math.cos(angle) * radiusPct;
          const y = 50 + Math.sin(angle) * radiusPct;
          return (
            <img
              key={sen.id}
              src={`/images/team/${sen.avatar}`}
              alt={sen.name}
              loading="lazy"
              style={{
                position: "absolute",
                top: `${y}%`,
                left: `${x}%`,
                transform: "translate(-50%, -50%)",
                width: "18%",
                height: "18%",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid rgba(255,144,105,0.6)",
                boxShadow: "0 0 12px rgba(255,144,105,0.4)",
              }}
            />
          );
        })}

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "40%",
            height: "40%",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ff9069, #ff2d88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "min(20vw, 120px)",
            lineHeight: 1,
            boxShadow: "0 0 60px rgba(255,144,105,0.7)",
          }}
        >
          👑
        </div>
      </div>
    </div>
  );
}
