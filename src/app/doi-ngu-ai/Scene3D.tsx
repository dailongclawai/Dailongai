"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ScrollControls, useScroll, Html } from "@react-three/drei";
import { useState } from "react";
import CameraRig from "./components/CameraRig";
import ParticleField from "./components/ParticleField";
import HeroScene from "./scenes/HeroScene";

const TOTAL_PAGES = 5;

function ScrollDebugHud() {
  const scroll = useScroll();
  const [pct, setPct] = useState(0);
  useFrame(() => {
    const next = Math.round(scroll.offset * 1000) / 10;
    if (next !== pct) setPct(next);
  });
  return (
    <Html
      position={[0, -3, 0]}
      center
      style={{
        color: "#00f2ff",
        fontFamily: "Share Tech Mono, monospace",
        fontSize: 12,
        letterSpacing: "0.2em",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        opacity: 0.6,
      }}
    >
      SCROLL :: {pct.toFixed(1)}%
    </Html>
  );
}

export default function Scene3D() {
  return (
    <div className="scene3d-wrap">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#050810"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.7} />
        <directionalLight position={[-5, -2, -5]} intensity={0.3} color="#ff9069" />
        <ScrollControls pages={TOTAL_PAGES} damping={0.18}>
          <ParticleField />
          <CameraRig />
          <HeroScene />
          <ScrollDebugHud />
        </ScrollControls>
      </Canvas>
    </div>
  );
}
