"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "../shaders/neuralMesh.glsl";

type Props = { position?: [number, number, number]; scale?: number };

export default function NexusCore({ position = [0, 0, 0], scale = 1.4 }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color("#00f2ff") },
      uColorB: { value: new THREE.Color("#ff9069") },
    }),
    [],
  );

  useFrame((_, dt) => {
    if (matRef.current) {
      (matRef.current.uniforms.uTime.value as number) += dt;
    }
  });

  return (
    <mesh position={position} scale={scale}>
      <icosahedronGeometry args={[1, 5]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
