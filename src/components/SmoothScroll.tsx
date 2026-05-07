"use client";

import { useEffect } from "react";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const isMobile = window.innerWidth < 768;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isMobile || prefersReduced) {
      document.body.classList.add("js-loaded", "no-animations");
      document.querySelectorAll(".opacity-0").forEach((el) => {
        (el as HTMLElement).style.opacity = "1";
        (el as HTMLElement).style.transform = "none";
      });
      return;
    }

    const init = async () => {
      try {
        // Load libraries sequentially to reduce main-thread pressure
        const { gsap: gsapModule, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
        // Yield to browser before loading Lenis
        await new Promise(r => setTimeout(r, 0));
        const { default: Lenis } = await import("lenis");
        gsapModule.ticker.lagSmoothing(500, 33);
        const lenis = new Lenis({ duration: 1.2, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), autoRaf: false, syncTouch: false });
        lenis.on("scroll", ScrollTrigger.update);
        gsapModule.ticker.add((time) => lenis.raf(time * 1000));
        document.body.classList.add("js-loaded");
      } catch (err) {
        console.warn("SmoothScroll init failed:", err);
        document.body.classList.add("js-loaded", "no-animations");
      }
    };
    // Defer GSAP+Lenis init to idle time (after LCP) — avoids blocking first user click.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      init();
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = window as IdleWindow;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (w.requestIdleCallback) {
      idleHandle = w.requestIdleCallback(start, { timeout: 2000 });
    } else {
      timeoutHandle = setTimeout(start, 1800);
    }

    return () => {
      if (idleHandle !== undefined && w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, []);

  return <>{children}</>;
}
