"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/**
 * LaserPulse — 3D animation representing 650nm laser therapy activating blood cells.
 * Central glowing core with orbiting red blood cell particles and expanding pulse rings.
 */
export default function LaserPulse() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    import("three").then((THREE) => {
      if (cancelled || !container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
      camera.position.set(0, 0, 22);

      // ── Colors ──
      const laserRed = new THREE.Color(0xff2200);
      const laserOrange = new THREE.Color(0xff6b00);
      const warmWhite = new THREE.Color(0xffccaa);
      const bloodRed = new THREE.Color(0xcc1100);

      // ── Central core (laser source) ──
      const coreGeo = new THREE.SphereGeometry(0.6, 24, 24);
      const coreMat = new THREE.MeshBasicMaterial({ color: laserOrange, transparent: true, opacity: 1 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      scene.add(core);

      // Core glow layers
      const glowSizes = [1.2, 2.0, 3.2];
      const glowOpacities = [0.25, 0.12, 0.05];
      const glows: THREE_NS.Mesh[] = [];
      glowSizes.forEach((size, i) => {
        const g = new THREE.Mesh(
          new THREE.SphereGeometry(size, 20, 20),
          new THREE.MeshBasicMaterial({ color: laserOrange, transparent: true, opacity: glowOpacities[i] })
        );
        scene.add(g);
        glows.push(g);
      });

      // ── Orbiting blood cell particles ──
      // Disc-shaped particles (torus = red blood cell shape)
      const cellGeo = new THREE.TorusGeometry(0.22, 0.08, 8, 16);
      const cellCount = 28;

      interface CellData {
        mesh: THREE_NS.Mesh;
        orbitRadius: number;
        orbitSpeed: number;
        orbitOffset: number;
        tiltX: number;
        tiltZ: number;
        yOscAmp: number;
        yOscSpeed: number;
      }
      const cells: CellData[] = [];

      for (let i = 0; i < cellCount; i++) {
        const color = i % 3 === 0 ? bloodRed : i % 3 === 1 ? laserRed : laserOrange;
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 + Math.random() * 0.3 });
        const mesh = new THREE.Mesh(cellGeo, mat);
        const orbitRadius = 3.5 + Math.random() * 7;
        mesh.scale.setScalar(0.6 + Math.random() * 0.8);
        scene.add(mesh);
        cells.push({
          mesh,
          orbitRadius,
          orbitSpeed: (0.15 + Math.random() * 0.35) * (Math.random() > 0.5 ? 1 : -1),
          orbitOffset: Math.random() * Math.PI * 2,
          tiltX: (Math.random() - 0.5) * 1.2,
          tiltZ: (Math.random() - 0.5) * 1.2,
          yOscAmp: 0.5 + Math.random() * 2,
          yOscSpeed: 0.3 + Math.random() * 0.6,
        });
      }

      // ── Pulse rings ──
      const ringCount = 3;
      interface RingData { mesh: THREE_NS.Mesh; phase: number; speed: number }
      const rings: RingData[] = [];

      for (let i = 0; i < ringCount; i++) {
        const ringGeo = new THREE.TorusGeometry(1, 0.03, 8, 80);
        const ringMat = new THREE.MeshBasicMaterial({ color: warmWhite, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);
        rings.push({ mesh: ring, phase: (i / ringCount) * Math.PI * 2, speed: 0.6 + i * 0.15 });
      }

      // ── Micro particles (energy dust) ──
      const dustCount = 100;
      const dustPos = new Float32Array(dustCount * 3);
      const dustVel: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < dustCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 12;
        dustPos[i * 3] = Math.cos(angle) * r;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
        dustPos[i * 3 + 2] = Math.sin(angle) * r;
        dustVel.push({
          x: (Math.random() - 0.5) * 0.015,
          y: (Math.random() - 0.5) * 0.015,
          z: (Math.random() - 0.5) * 0.015,
        });
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
      const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          color: laserOrange,
          size: 0.08,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
        })
      );
      scene.add(dust);

      // ── Laser beam lines (radial) ──
      const beamCount = 5;
      const beams: THREE_NS.Line[] = [];
      for (let i = 0; i < beamCount; i++) {
        const angle = (i / beamCount) * Math.PI * 2;
        const len = 6 + Math.random() * 4;
        const pts = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(angle) * len, (Math.random() - 0.5) * 2, Math.sin(angle) * len),
        ];
        const bGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const bMat = new THREE.LineBasicMaterial({ color: laserRed, transparent: true, opacity: 0 });
        const beam = new THREE.Line(bGeo, bMat);
        scene.add(beam);
        beams.push(beam);
      }

      // ── Mouse (rAF-throttled) ──
      let targetRotY = 0;
      let targetRotX = 0;
      let cachedRect = container.getBoundingClientRect();
      let mouseTicking = false;
      const onMouseMove = (e: MouseEvent) => {
        if (mouseTicking) return;
        mouseTicking = true;
        const cx = e.clientX, cy = e.clientY;
        requestAnimationFrame(() => {
          targetRotY = (((cx - cachedRect.left) / cachedRect.width) * 2 - 1) * 0.4;
          targetRotX = (-((cy - cachedRect.top) / cachedRect.height) * 2 + 1) * 0.25;
          mouseTicking = false;
        });
      };
      container.addEventListener("mousemove", onMouseMove, { passive: true });

      // ── Visibility (pause when off-screen) ──
      let isVisible = true;
      const io = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0 });
      io.observe(container);

      // ── Animation ──
      let t = 0;
      let animId: number;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (!isVisible) return;
        t += 0.008;

        // Core pulse
        const pulse = 1 + Math.sin(t * 3) * 0.15;
        core.scale.setScalar(pulse);
        coreMat.opacity = 0.85 + Math.sin(t * 4) * 0.15;
        glows.forEach((g, i) => {
          g.scale.setScalar(pulse * (1 + i * 0.1 + Math.sin(t * 2 + i) * 0.1));
          (g.material as THREE_NS.MeshBasicMaterial).opacity = glowOpacities[i] * (0.7 + Math.sin(t * 3 + i * 0.5) * 0.3);
        });

        // Orbit cells
        cells.forEach((c) => {
          const angle = t * c.orbitSpeed + c.orbitOffset;
          c.mesh.position.x = Math.cos(angle) * c.orbitRadius;
          c.mesh.position.z = Math.sin(angle) * c.orbitRadius;
          c.mesh.position.y = Math.sin(t * c.yOscSpeed + c.orbitOffset) * c.yOscAmp;
          c.mesh.rotation.x = t * 0.5 + c.tiltX;
          c.mesh.rotation.z = t * 0.3 + c.tiltZ;
          // Fade based on distance from camera
          const dist = c.mesh.position.z;
          (c.mesh.material as THREE_NS.MeshBasicMaterial).opacity = 0.4 + (dist + c.orbitRadius) / (c.orbitRadius * 2) * 0.6;
        });

        // Pulse rings expand outward, then reset
        rings.forEach((r) => {
          const cycle = ((t * r.speed + r.phase) % (Math.PI * 2)) / (Math.PI * 2);
          const scale = 1 + cycle * 12;
          r.mesh.scale.setScalar(scale);
          (r.mesh.material as THREE_NS.MeshBasicMaterial).opacity = (1 - cycle) * 0.25;
        });

        // Laser beam flicker
        beams.forEach((beam, i) => {
          const flicker = Math.sin(t * 6 + i * 1.5);
          (beam.material as THREE_NS.LineBasicMaterial).opacity = flicker > 0.7 ? 0.15 + flicker * 0.2 : 0;
        });

        // Dust drift
        const dArr = dust.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < dustCount; i++) {
          const i3 = i * 3;
          dArr[i3] += dustVel[i].x;
          dArr[i3 + 1] += dustVel[i].y;
          dArr[i3 + 2] += dustVel[i].z;
          const dist = Math.sqrt(dArr[i3] ** 2 + dArr[i3 + 2] ** 2);
          if (dist > 14 || dist < 0.8) { dustVel[i].x *= -1; dustVel[i].z *= -1; }
          if (Math.abs(dArr[i3 + 1]) > 5) dustVel[i].y *= -1;
        }
        dust.geometry.attributes.position.needsUpdate = true;

        // Camera
        camera.rotation.y += (targetRotY - camera.rotation.y) * 0.04;
        camera.rotation.x += (targetRotX - camera.rotation.x) * 0.04;
        camera.position.y = Math.sin(t * 0.4) * 0.4;

        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const onResize = () => {
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        cachedRect = container.getBoundingClientRect();
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(container);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        io.disconnect();
        ro.disconnect();
        container.removeEventListener("mousemove", onMouseMove);
        renderer.dispose();
        scene.clear();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
      };
    });

    return () => { cancelled = true; cleanupRef.current?.(); };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[220px] sm:min-h-[280px] lg:min-h-[350px]">
      <div ref={containerRef} className="absolute inset-0" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] sm:w-[350px] sm:h-[350px] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255, 34, 0, 0.10) 0%, rgba(255, 107, 0, 0.05) 40%, transparent 70%)" }}
      />
    </div>
  );
}
