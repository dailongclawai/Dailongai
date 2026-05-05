"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ScrollControls, useScroll, Html } from "@react-three/drei";
import { useState } from "react";
import CameraRig from "./components/CameraRig";

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
      position={[0, 0, -2]}
      center
      style={{
        color: "#00f2ff",
        fontFamily: "Share Tech Mono, monospace",
        fontSize: 14,
        letterSpacing: "0.2em",
        pointerEvents: "none",
        whiteSpace: "nowrap",
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
        <ScrollControls pages={TOTAL_PAGES} damping={0.18}>
          <CameraRig />
          <ScrollDebugHud />
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff9069" wireframe />
          </mesh>
        </ScrollControls>
      </Canvas>
    </div>
  );
}
