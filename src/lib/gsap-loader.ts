import type gsapType from "gsap";
import type { ScrollTrigger as STType } from "gsap/ScrollTrigger";

let cached: { gsap: typeof gsapType; ScrollTrigger: typeof STType } | null = null;
let loading: Promise<{ gsap: typeof gsapType; ScrollTrigger: typeof STType }> | null = null;

export function loadGSAP(): Promise<{ gsap: typeof gsapType; ScrollTrigger: typeof STType }> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
    ([{ default: gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      cached = { gsap, ScrollTrigger };
      return cached;
    }
  );

  return loading;
}
