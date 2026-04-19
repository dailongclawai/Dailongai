"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/**
 * WelcomePortal — Warm, inviting 3D animation for showroom section.
 * A glowing portal/archway with particles streaming inward, representing
 * an open door welcoming visitors.
 */
export default function WelcomePortal({ welcomeTitle, welcomeDesc }: { welcomeTitle?: string; welcomeDesc?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    import("three").then((THREE) => {
      if (cancelled || !el) return;

      const w = el.clientWidth;
      const h = el.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x0c0e10, 1);
      el.appendChild(renderer.domElement);
      camera.position.set(0, 0.5, 10);
      camera.lookAt(0, 0.5, 0);

      const group = new THREE.Group();
      scene.add(group);

      const primary = new THREE.Color(0xff6b00);
      const warm = new THREE.Color(0xffaa55);
      const gold = new THREE.Color(0xffd700);
      const white = new THREE.Color(0xffffff);

      // ── Portal arch (two pillars + arch curve) ──
      const pillarGeo = new THREE.BoxGeometry(0.25, 6, 0.25);
      const pillarMat = new THREE.MeshBasicMaterial({ color: warm, transparent: true, opacity: 0.35 });

      const leftPillar = new THREE.Mesh(pillarGeo, pillarMat.clone());
      leftPillar.position.set(-2.8, 0, 0);
      group.add(leftPillar);

      const rightPillar = new THREE.Mesh(pillarGeo, pillarMat.clone());
      rightPillar.position.set(2.8, 0, 0);
      group.add(rightPillar);

      // Arch curve on top
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.8, 3, 0),
        new THREE.Vector3(-2, 4.2, 0),
        new THREE.Vector3(0, 4.8, 0),
        new THREE.Vector3(2, 4.2, 0),
        new THREE.Vector3(2.8, 3, 0),
      ]);
      const archPts = archCurve.getPoints(40);
      const archGeo = new THREE.BufferGeometry().setFromPoints(archPts);
      const archLine = new THREE.Line(archGeo, new THREE.LineBasicMaterial({ color: warm, transparent: true, opacity: 0.5 }));
      group.add(archLine);

      // Inner glow arch (thicker, softer)
      const archGlowPts = archCurve.getPoints(30);
      archGlowPts.forEach((pt) => {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 6, 6),
          new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.3 })
        );
        glow.position.copy(pt);
        group.add(glow);
      });

      // Pillar glow accents
      [-2.8, 2.8].forEach((x) => {
        for (let y = -2.5; y <= 3; y += 0.8) {
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 6, 6),
            new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: 0.4 })
          );
          dot.position.set(x, y, 0.15);
          group.add(dot);
        }
      });

      // ── Base line (floor) ──
      const floorPts = [new THREE.Vector3(-4, -3, 0), new THREE.Vector3(4, -3, 0)];
      const floorLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(floorPts),
        new THREE.LineBasicMaterial({ color: warm, transparent: true, opacity: 0.15 })
      );
      group.add(floorLine);

      // ── Inner portal glow (the "light" inside the door) ──
      const innerGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 7),
        new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: 0.04, side: THREE.DoubleSide })
      );
      innerGlow.position.set(0, 0.5, -0.5);
      group.add(innerGlow);

      // Stronger center glow
      const centerGlow = new THREE.Mesh(
        new THREE.CircleGeometry(2.5, 32),
        new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
      );
      centerGlow.position.set(0, 1, -0.3);
      group.add(centerGlow);

      // ── Streaming particles (flowing inward through the portal) ──
      const streamCount = 120;
      const streamPos = new Float32Array(streamCount * 3);
      interface StreamParticle { speed: number; x: number; yBase: number; phase: number }
      const streamData: StreamParticle[] = [];

      for (let i = 0; i < streamCount; i++) {
        const x = (Math.random() - 0.5) * 5;
        const y = -3 + Math.random() * 7.5;
        const z = 5 + Math.random() * 8;
        streamPos[i * 3] = x;
        streamPos[i * 3 + 1] = y;
        streamPos[i * 3 + 2] = z;
        streamData.push({
          speed: 0.03 + Math.random() * 0.05,
          x,
          yBase: y,
          phase: Math.random() * Math.PI * 2,
        });
      }

      const streamGeo = new THREE.BufferGeometry();
      streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
      const stream = new THREE.Points(streamGeo, new THREE.PointsMaterial({
        color: gold, size: 0.07, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending,
      }));
      group.add(stream);

      // ── Floating sparkles around arch ──
      const sparkleCount = 40;
      const sparkles: THREE_NS.Mesh[] = [];
      for (let i = 0; i < sparkleCount; i++) {
        const angle = Math.random() * Math.PI;
        const r = 2.5 + Math.random() * 1.5;
        const sparkle = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 4, 4),
          new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? gold : white,
            transparent: true,
            opacity: 0.3 + Math.random() * 0.4,
          })
        );
        sparkle.position.set(
          Math.cos(angle) * r,
          2 + Math.sin(angle) * r,
          (Math.random() - 0.5) * 2,
        );
        group.add(sparkle);
        sparkles.push(sparkle);
      }

      // ── Pulse rings expanding from portal center ──
      const ringCount = 3;
      interface PulseRing { mesh: THREE_NS.Mesh; phase: number }
      const pulseRings: PulseRing[] = [];
      for (let i = 0; i < ringCount; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.015, 8, 60),
          new THREE.MeshBasicMaterial({ color: warm, transparent: true, opacity: 0 })
        );
        ring.position.set(0, 1, 0);
        group.add(ring);
        pulseRings.push({ mesh: ring, phase: (i / ringCount) * Math.PI * 2 });
      }

      // ── Mouse (rAF-throttled) ──
      let tgtY = 0, tgtX = 0;
      let cachedRect = el.getBoundingClientRect();
      let mouseTicking = false;
      const onMouse = (e: MouseEvent) => {
        if (mouseTicking) return;
        mouseTicking = true;
        const cx = e.clientX, cy = e.clientY;
        requestAnimationFrame(() => {
          tgtY = (((cx - cachedRect.left) / cachedRect.width) * 2 - 1) * 0.15;
          tgtX = (-((cy - cachedRect.top) / cachedRect.height) * 2 + 1) * 0.1;
          mouseTicking = false;
        });
      };
      el.addEventListener("mousemove", onMouse, { passive: true });

      // Visibility (pause when off-screen)
      let isVisible = true;
      const io = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0 });
      io.observe(el);

      // ── Animate ──
      let t = 0;
      let animId: number;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (!isVisible) return;
        t += 0.006;

        // Portal glow pulse
        (innerGlow.material as THREE_NS.MeshBasicMaterial).opacity = 0.03 + Math.sin(t * 2) * 0.02;
        (centerGlow.material as THREE_NS.MeshBasicMaterial).opacity = 0.04 + Math.sin(t * 1.5) * 0.03;

        // Pillar subtle glow
        (leftPillar.material as THREE_NS.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 2) * 0.05;
        (rightPillar.material as THREE_NS.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 2 + 1) * 0.05;

        // Streaming particles flow toward portal
        const sArr = stream.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < streamCount; i++) {
          const d = streamData[i];
          const i3 = i * 3;
          sArr[i3 + 2] -= d.speed; // move toward camera/portal
          sArr[i3] = d.x + Math.sin(t * 1.5 + d.phase) * 0.3; // gentle sway
          sArr[i3 + 1] = d.yBase + Math.sin(t + d.phase) * 0.2;

          // Reset when past portal
          if (sArr[i3 + 2] < -2) {
            sArr[i3 + 2] = 5 + Math.random() * 8;
            d.x = (Math.random() - 0.5) * 5;
            d.yBase = -3 + Math.random() * 7.5;
            sArr[i3] = d.x;
            sArr[i3 + 1] = d.yBase;
          }
        }
        stream.geometry.attributes.position.needsUpdate = true;

        // Sparkles twinkle
        sparkles.forEach((s, i) => {
          (s.material as THREE_NS.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 3 + i * 0.8) * 0.35;
          s.position.y += Math.sin(t * 2 + i) * 0.002;
        });

        // Pulse rings
        pulseRings.forEach((r) => {
          const cycle = ((t * 0.5 + r.phase) % (Math.PI * 2)) / (Math.PI * 2);
          r.mesh.scale.setScalar(1 + cycle * 4);
          (r.mesh.material as THREE_NS.MeshBasicMaterial).opacity = Math.max(0, (1 - cycle) * 0.2);
        });

        // Camera
        camera.rotation.y += (tgtY - camera.rotation.y) * 0.03;
        camera.rotation.x += (tgtX - camera.rotation.x) * 0.03;

        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const nw = el.clientWidth;
        const nh = el.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        cachedRect = el.getBoundingClientRect();
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(el);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        io.disconnect();
        ro.disconnect();
        el.removeEventListener("mousemove", onMouse);
        renderer.dispose();
        scene.clear();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
      };
    });

    return () => { cancelled = true; cleanupRef.current?.(); };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Welcome text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none px-6">
        <p className="text-primary/70 text-[10px] uppercase tracking-[0.35em] font-headline font-bold mb-3">Welcome</p>
        <h4 className="text-on-surface text-xl sm:text-2xl font-black font-headline tracking-tight text-center leading-snug mb-2">
          {welcomeTitle ?? "Chào mừng quý khách"}
        </h4>
        <p className="text-secondary/60 text-xs sm:text-sm text-center max-w-[240px] leading-relaxed">
          {welcomeDesc ?? "Ghé thăm showroom để trải nghiệm sản phẩm trực tiếp"}
        </p>
        <div className="mt-5 flex items-center gap-2">
          <div className="w-8 h-[1px] bg-gradient-to-r from-transparent to-primary/30" />
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
          <div className="w-8 h-[1px] bg-gradient-to-l from-transparent to-primary/30" />
        </div>
      </div>
    </div>
  );
}
