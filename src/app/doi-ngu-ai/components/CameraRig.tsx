"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

const WAYPOINTS: [number, number, number][] = [
  [0, 0.5, 8],
  [0, 0, 4.5],
  [-3, -1.5, 5],
  [3, -3.5, 5],
  [0, -6, 7.5],
  [0, -8, 3],
];

const LOOKATS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 0],
  [-3, -1.5, 0],
  [3, -3.5, 0],
  [0, -6, 0],
  [0, -8, -2],
];

export default function CameraRig() {
  const { camera } = useThree();
  const scroll = useScroll();

  const posCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        WAYPOINTS.map((p) => new THREE.Vector3(...p)),
        false,
        "catmullrom",
        0.4,
      ),
    [],
  );
  const lookCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        LOOKATS.map((p) => new THREE.Vector3(...p)),
        false,
        "catmullrom",
        0.4,
      ),
    [],
  );

  useFrame(() => {
    const t = THREE.MathUtils.clamp(scroll.offset, 0, 1);
    const pos = posCurve.getPoint(t);
    const look = lookCurve.getPoint(t);
    camera.position.copy(pos);
    camera.lookAt(look);
  });

  return null;
}
