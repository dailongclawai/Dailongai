"use client";

import { useScroll, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import NexusCore from "../components/NexusCore";
import SpatialPanel from "../components/SpatialPanel";
import AvatarBillboard from "../components/AvatarBillboard";
import { departments, allMembers } from "../data/agents";

const ORBIT_RADIUS = 2.5;
const ORBIT_HEIGHT_VARIANCE = 1.2;

const PANEL_POSITIONS: [number, number, number][] = [
  [-2.6, 0.4, 0.5],
  [-0.9, 1.2, -0.2],
  [0.9, 1.0, -0.3],
  [2.6, 0.2, 0.6],
];

export default function HeroScene() {
  const scroll = useScroll();
  const orbitRef = useRef<THREE.Group>(null);
  const [progress, setProgress] = useState(0);

  const orbitSlots = useMemo(
    () =>
      allMembers.map((sen, i) => {
        const dept = departments.find((d) => d.members.includes(sen))!;
        const phase = (i / allMembers.length) * Math.PI * 2;
        const radius = ORBIT_RADIUS + ((i % 3) - 1) * 0.4;
        const yOffset = Math.sin(i * 1.3) * ORBIT_HEIGHT_VARIANCE;
        return { sen, dept, phase, radius, yOffset };
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y = clock.elapsedTime * 0.18;
    }
    const heroProgress = THREE.MathUtils.clamp(scroll.offset / 0.35, 0, 1);
    if (Math.abs(heroProgress - progress) > 0.01) {
      setProgress(heroProgress);
    }
  });

  const orbitVisible = progress > 0.35;
  const nexusVisible = progress > 0.18;

  return (
    <group>
      {departments.map((d, i) => (
        <SpatialPanel
          key={d.key}
          position={PANEL_POSITIONS[i]}
          rotation={[0, (PANEL_POSITIONS[i][0] > 0 ? -1 : 1) * 0.25, 0]}
          title={`${d.emoji} ${d.label.toUpperCase()}`}
          subtitle={`${d.members.length} thành viên`}
          accent={d.hex}
          scrollProgress={progress}
          centerTarget={[0, 0, 0]}
        />
      ))}

      <group visible={nexusVisible}>
        <NexusCore position={[0, 0, 0]} scale={1.2} />
      </group>

      <group ref={orbitRef} visible={orbitVisible}>
        {orbitSlots.map(({ sen, dept, phase, radius, yOffset }) => {
          const x = Math.cos(phase) * radius;
          const z = Math.sin(phase) * radius;
          return (
            <AvatarBillboard
              key={sen.id}
              src={`/images/team/${sen.avatar}`}
              position={[x, yOffset, z]}
              size={0.55}
              haloColor={dept.hex}
            />
          );
        })}

        <Text
          position={[0, 2.2, 0]}
          fontSize={0.6}
          color="#ff9069"
          anchorX="center"
          anchorY="middle"
        >
          👑
        </Text>
        <Text
          position={[0, 1.7, 0]}
          fontSize={0.18}
          color="#ff9069"
          anchorX="center"
          anchorY="middle"
        >
          ÔNG CHỦ
        </Text>
      </group>
    </group>
  );
}
