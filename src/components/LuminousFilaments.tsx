"use client";

import { useEffect, useRef } from "react";

/**
 * LuminousFilaments — Parametric ribbons of light weave around the centred
 * "32+" label without ever touching it. Pure 2D Canvas, additive blending.
 * Each filament is a closed curve generated from layered sine harmonics whose
 * parameters drift slowly, so the rosette never repeats. Represents the
 * organic creativity that has emerged from 32+ years of focused research.
 */
export default function LuminousFilaments() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cachedRect: DOMRect | null = null;
    function resize() {
      if (!canvas || !ctx) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cachedRect = canvas.getBoundingClientRect();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Filament definitions ──
    interface Filament {
      radiusOffset: number;
      freqA: number;
      freqB: number;
      ampA: number;
      ampB: number;
      phase: number;
      driftA: number;
      driftB: number;
      width: number;
      hue: string;
      glow: number;
    }

    const PRIMARY = "rgba(255, 130, 40, 1)";
    const WARM = "rgba(255, 180, 95, 1)";
    const CREAM = "rgba(255, 225, 180, 1)";

    const filaments: Filament[] = [
      { radiusOffset: 0,  freqA: 3, freqB: 7, ampA: 16, ampB: 6,  phase: 0,    driftA: 0.18, driftB: 0.11, width: 1.4, hue: PRIMARY, glow: 14 },
      { radiusOffset: 6,  freqA: 4, freqB: 6, ampA: 14, ampB: 7,  phase: 1.1,  driftA: 0.13, driftB: 0.16, width: 1.1, hue: WARM,    glow: 10 },
      { radiusOffset: 12, freqA: 5, freqB: 8, ampA: 12, ampB: 5,  phase: 2.4,  driftA: 0.21, driftB: 0.09, width: 0.9, hue: CREAM,   glow: 7  },
      { radiusOffset: 18, freqA: 2, freqB: 9, ampA: 18, ampB: 4,  phase: 3.7,  driftA: 0.10, driftB: 0.18, width: 1.2, hue: WARM,    glow: 11 },
      { radiusOffset: 24, freqA: 6, freqB: 5, ampA: 9,  ampB: 6,  phase: 5.0,  driftA: 0.16, driftB: 0.13, width: 0.8, hue: PRIMARY, glow: 8  },
    ];

    // ── Drifting sparks (ambient particles) ──
    interface Spark {
      angle: number;
      radius: number;
      angularSpeed: number;
      size: number;
      twinkle: number;
      twinkleSpeed: number;
      cream: boolean;
    }
    const SPARK_COUNT = 80;
    const sparks: Spark[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      sparks.push({
        angle: Math.random() * Math.PI * 2,
        radius: 100 + Math.random() * 70,
        angularSpeed: (Math.random() - 0.5) * 0.0014,
        size: 0.5 + Math.random() * 1.4,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.025 + Math.random() * 0.035,
        cream: Math.random() > 0.6,
      });
    }

    // ── Mouse: subtle warp toward cursor (rAF-throttled) ──
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let mouseTicking = false;
    const onMouse = (e: MouseEvent) => {
      if (!cachedRect || mouseTicking) return;
      mouseTicking = true;
      const cx = e.clientX, cy = e.clientY;
      requestAnimationFrame(() => {
        if (cachedRect) {
          mouse.tx = ((cx - cachedRect.left) / cachedRect.width - 0.5) * 10;
          mouse.ty = ((cy - cachedRect.top) / cachedRect.height - 0.5) * 10;
        }
        mouseTicking = false;
      });
    };
    const onLeave = () => {
      mouse.tx = 0;
      mouse.ty = 0;
    };
    canvas.addEventListener("mousemove", onMouse, { passive: true });
    canvas.addEventListener("mouseleave", onLeave, { passive: true });

    // Visibility (pause when off-screen)
    let isVisible = true;
    const io = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    // ── Animation loop ──
    let raf = 0;
    let t = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!isVisible) return;
      t += 0.01;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const cx = width / 2 + mouse.x;
      const cy = height / 2 + mouse.y;

      // Inner safe zone for "32+" text. Keeps base radius outside this.
      const safe = Math.min(width, height) * 0.34;
      const baseR = safe + 12;

      ctx.clearRect(0, 0, width, height);

      // Subtle ambient warmth glow on the perimeter only — never reaches centre
      const ring = ctx.createRadialGradient(cx, cy, baseR * 0.95, cx, cy, baseR * 2.0);
      ring.addColorStop(0, "rgba(255, 110, 30, 0)");
      ring.addColorStop(0.35, "rgba(255, 110, 30, 0.06)");
      ring.addColorStop(1, "rgba(255, 110, 30, 0)");
      ctx.fillStyle = ring;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";

      // ── Draw filaments ──
      const SEGMENTS = 220;
      filaments.forEach((f, idx) => {
        const r0 = baseR + f.radiusOffset;

        // Slow parameter drift gives the curve a perpetually new shape
        const driftedAmpA = f.ampA + Math.sin(t * f.driftA + idx) * 3;
        const driftedAmpB = f.ampB + Math.sin(t * f.driftB - idx) * 2;
        const phaseA = f.phase + t * f.driftA * 0.5;
        const phaseB = f.phase * 1.7 - t * f.driftB * 0.4;

        ctx.beginPath();
        for (let s = 0; s <= SEGMENTS; s++) {
          const theta = (s / SEGMENTS) * Math.PI * 2;
          const distortion =
            Math.sin(theta * f.freqA + phaseA) * driftedAmpA +
            Math.sin(theta * f.freqB + phaseB) * driftedAmpB;
          const r = r0 + distortion;
          const x = cx + Math.cos(theta) * r;
          const y = cy + Math.sin(theta) * r;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.lineWidth = f.width;
        ctx.strokeStyle = f.hue;
        ctx.shadowColor = f.hue;
        ctx.shadowBlur = f.glow + Math.sin(t * 1.3 + idx) * 2;
        ctx.globalAlpha = 0.42 + Math.sin(t * 0.7 + idx * 0.9) * 0.12;
        ctx.stroke();
      });

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // ── Draw sparks ──
      for (let i = 0; i < sparks.length; i++) {
        const p = sparks[i];
        p.angle += p.angularSpeed;
        p.twinkle += p.twinkleSpeed;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius;
        const a = 0.25 + Math.sin(p.twinkle) * 0.35;
        if (a <= 0) continue;
        ctx.fillStyle = p.cream
          ? `rgba(255, 230, 200, ${a})`
          : `rgba(255, 175, 90, ${a})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[240px]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
