"use client";

import { Stars, Sparkles } from "@react-three/drei";

export default function ParticleField() {
  return (
    <>
      <Stars
        radius={50}
        depth={40}
        count={2000}
        factor={3}
        saturation={0}
        fade
        speed={0.4}
      />
      <Sparkles
        count={80}
        scale={[18, 12, 8]}
        size={2}
        speed={0.4}
        opacity={0.5}
        color="#00f2ff"
      />
    </>
  );
}
