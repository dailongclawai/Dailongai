"use client";

import { MeshTransmissionMaterial, Text, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

type Props = {
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  title: string;
  subtitle: string;
  accent: string;
  scrollProgress: number;
  centerTarget: [number, number, number];
};

export default function SpatialPanel({
  position,
  rotation = [0, 0, 0],
  width = 1.4,
  height = 0.9,
  title,
  subtitle,
  accent,
  scrollProgress,
  centerTarget,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.rotation.y = rotation[1] + Math.sin(t * 0.4 + position[0]) * 0.06;

    const k = THREE.MathUtils.smoothstep(scrollProgress, 0.0, 0.25);
    const scale = 1 - k * 0.95;
    groupRef.current.scale.setScalar(scale);
    groupRef.current.position.set(
      THREE.MathUtils.lerp(position[0], centerTarget[0], k),
      THREE.MathUtils.lerp(position[1], centerTarget[1], k),
      THREE.MathUtils.lerp(position[2], centerTarget[2], k),
    );
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <RoundedBox args={[width, height, 0.04]} radius={0.05} smoothness={4}>
        <MeshTransmissionMaterial
          backside
          thickness={0.2}
          roughness={0.05}
          transmission={1}
          ior={1.4}
          chromaticAberration={0.02}
          color="#ffffff"
          attenuationColor={accent}
          attenuationDistance={0.6}
        />
      </RoundedBox>
      <Text
        position={[0, 0.18, 0.04]}
        fontSize={0.12}
        color={accent}
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      <Text
        position={[0, -0.05, 0.04]}
        fontSize={0.06}
        color="#e8eaed"
        anchorX="center"
        anchorY="middle"
        maxWidth={width * 0.85}
      >
        {subtitle}
      </Text>
    </group>
  );
}
