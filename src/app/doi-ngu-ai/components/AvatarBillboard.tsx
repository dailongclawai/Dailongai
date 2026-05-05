"use client";

import { Billboard, Image as DreiImage } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

type Props = {
  src: string;
  position: [number, number, number];
  size?: number;
  haloColor?: string;
};

export default function AvatarBillboard({
  src,
  position,
  size = 0.7,
  haloColor = "#00f2ff",
}: Props) {
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (haloRef.current) {
      const t = clock.elapsedTime;
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + 0.15 * Math.sin(t * 1.4 + position[0]);
    }
  });

  return (
    <Billboard position={position} follow={true}>
      <mesh ref={haloRef} scale={size * 1.6}>
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <DreiImage
        url={src}
        scale={size}
        toneMapped={false}
      />
    </Billboard>
  );
}
