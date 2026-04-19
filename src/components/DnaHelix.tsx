"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

export default function DnaHelix() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    import("three").then((THREE) => {
      if (cancelled || !container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      camera.position.z = 15;

      // DNA Helix configuration
      const helixRadius = 3;
      const helixHeight = 12;
      const helixTurns = 3;
      const pointsPerTurn = 40;
      const totalPoints = helixTurns * pointsPerTurn;

      const colorOrange = new THREE.Color(0xff6b00);
      const colorWhite = new THREE.Color(0xffffff);
      const colorDark = new THREE.Color(0xff8c33);

      // Generate helix points
      const strand1Points: THREE_NS.Vector3[] = [];
      const strand2Points: THREE_NS.Vector3[] = [];

      for (let i = 0; i < totalPoints; i++) {
        const t = (i / totalPoints) * helixTurns * Math.PI * 2;
        const y = (i / totalPoints) * helixHeight - helixHeight / 2;
        strand1Points.push(new THREE.Vector3(Math.cos(t) * helixRadius, y, Math.sin(t) * helixRadius));
        strand2Points.push(new THREE.Vector3(Math.cos(t + Math.PI) * helixRadius, y, Math.sin(t + Math.PI) * helixRadius));
      }

      // Sphere geometry (shared)
      const sphereGeo = new THREE.SphereGeometry(0.15, 12, 12);
      const glowGeo = new THREE.SphereGeometry(0.25, 12, 12);

      const spheres1: THREE_NS.Mesh[] = [];
      const spheres2: THREE_NS.Mesh[] = [];

      strand1Points.forEach((point) => {
        const mat = new THREE.MeshBasicMaterial({ color: colorOrange, transparent: true, opacity: 0.9 });
        const sphere = new THREE.Mesh(sphereGeo, mat);
        sphere.position.copy(point);
        scene.add(sphere);
        spheres1.push(sphere);

        const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: colorOrange, transparent: true, opacity: 0.2 }));
        glow.position.copy(point);
        scene.add(glow);
        sphere.userData.glow = glow;
      });

      strand2Points.forEach((point) => {
        const mat = new THREE.MeshBasicMaterial({ color: colorWhite, transparent: true, opacity: 0.8 });
        const sphere = new THREE.Mesh(sphereGeo, mat);
        sphere.position.copy(point);
        scene.add(sphere);
        spheres2.push(sphere);

        const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: colorWhite, transparent: true, opacity: 0.15 }));
        glow.position.copy(point);
        scene.add(glow);
        sphere.userData.glow = glow;
      });

      // Connection lines (base pairs)
      const lineMat = new THREE.LineBasicMaterial({ color: colorDark, transparent: true, opacity: 0.4 });
      const connectionLines: { line: THREE_NS.Line; index: number }[] = [];

      for (let i = 0; i < totalPoints; i += 4) {
        const geo = new THREE.BufferGeometry().setFromPoints([strand1Points[i], strand2Points[i]]);
        const line = new THREE.Line(geo, lineMat.clone());
        scene.add(line);
        connectionLines.push({ line, index: i });
      }

      // Floating particles
      const particleCount = 150;
      const positions = new Float32Array(particleCount * 3);
      const velocities: { x: number; y: number; z: number }[] = [];

      for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 30;
        positions[i + 1] = (Math.random() - 0.5) * 20;
        positions[i + 2] = (Math.random() - 0.5) * 30;
        velocities.push({
          x: (Math.random() - 0.5) * 0.02,
          y: (Math.random() - 0.5) * 0.02,
          z: (Math.random() - 0.5) * 0.02,
        });
      }

      const particlesGeo = new THREE.BufferGeometry();
      particlesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particles = new THREE.Points(
        particlesGeo,
        new THREE.PointsMaterial({ color: colorOrange, size: 0.1, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })
      );
      scene.add(particles);

      // Mouse interaction (rAF-throttled)
      let targetRotY = 0;
      let targetRotX = 0;

      let cachedRect = container.getBoundingClientRect();
      let mouseTicking = false;
      const onMouseMove = (e: MouseEvent) => {
        if (mouseTicking) return;
        mouseTicking = true;
        const cx = e.clientX, cy = e.clientY;
        requestAnimationFrame(() => {
          const mx = ((cx - cachedRect.left) / cachedRect.width) * 2 - 1;
          const my = -((cy - cachedRect.top) / cachedRect.height) * 2 + 1;
          targetRotY = mx * 0.5;
          targetRotX = my * 0.3;
          mouseTicking = false;
        });
      };
      container.addEventListener("mousemove", onMouseMove, { passive: true });

      // Visibility (pause when off-screen)
      let isVisible = true;
      const io = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0 });
      io.observe(container);

      // Animation loop
      let time = 0;
      let animId: number;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (!isVisible) return;
        time += 0.01;

        spheres1.forEach((sphere, i) => {
          const rot = time * 0.3;
          const angle = rot + (i / spheres1.length) * helixTurns * Math.PI * 2;
          sphere.position.x = Math.cos(angle) * helixRadius;
          sphere.position.z = Math.sin(angle) * helixRadius;
          if (sphere.userData.glow) {
            sphere.userData.glow.position.copy(sphere.position);
            sphere.userData.glow.scale.setScalar(1 + Math.sin(time * 2 + i * 0.1) * 0.2);
          }
          sphere.scale.setScalar(1 + Math.sin(time * 2 + i * 0.2) * 0.1);
        });

        spheres2.forEach((sphere, i) => {
          const rot = time * 0.3;
          const angle = rot + Math.PI + (i / spheres2.length) * helixTurns * Math.PI * 2;
          sphere.position.x = Math.cos(angle) * helixRadius;
          sphere.position.z = Math.sin(angle) * helixRadius;
          if (sphere.userData.glow) {
            sphere.userData.glow.position.copy(sphere.position);
            sphere.userData.glow.scale.setScalar(1 + Math.sin(time * 2 + i * 0.1) * 0.2);
          }
          sphere.scale.setScalar(1 + Math.sin(time * 2 + i * 0.2 + 0.5) * 0.1);
        });

        connectionLines.forEach((conn, ci) => {
          const geo = new THREE.BufferGeometry().setFromPoints([
            spheres1[conn.index].position.clone(),
            spheres2[conn.index].position.clone(),
          ]);
          conn.line.geometry.dispose();
          conn.line.geometry = geo;
          (conn.line.material as THREE_NS.LineBasicMaterial).opacity = 0.3 + Math.sin(time * 2 + ci * 0.3) * 0.2;
        });

        // Animate particles
        const pos = particles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          pos[i3] += velocities[i].x;
          pos[i3 + 1] += velocities[i].y;
          pos[i3 + 2] += velocities[i].z;
          if (Math.abs(pos[i3]) > 15) velocities[i].x *= -1;
          if (Math.abs(pos[i3 + 1]) > 10) velocities[i].y *= -1;
          if (Math.abs(pos[i3 + 2]) > 15) velocities[i].z *= -1;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        camera.rotation.y += (targetRotY - camera.rotation.y) * 0.05;
        camera.rotation.x += (targetRotX - camera.rotation.x) * 0.05;
        camera.position.y = Math.sin(time * 0.5) * 0.5;
        camera.position.x = Math.cos(time * 0.3) * 0.3;

        renderer.render(scene, camera);
      };

      animate();

      // Resize handler
      const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        cachedRect = container.getBoundingClientRect();
      };

      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        io.disconnect();
        resizeObserver.disconnect();
        container.removeEventListener("mousemove", onMouseMove);
        renderer.dispose();
        scene.clear();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[400px]">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Glow overlay */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255, 107, 0, 0.15) 0%, transparent 70%)" }}
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-[9px] text-secondary/30 tracking-[0.2em] uppercase animate-pulse">
          Innovation in Healthcare
        </span>
      </div>
    </div>
  );
}
