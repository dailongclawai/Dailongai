import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Stagger-up: children animate up with stagger */
export function staggerUp(
  trigger: string | Element,
  targets: string | Element | Element[],
  options?: { delay?: number; stagger?: number; y?: number }
) {
  if (!targets || (Array.isArray(targets) && targets.length === 0)) return null;
  return gsap.fromTo(
    targets,
    {
      y: options?.y ?? 80,
      opacity: 0,
    },
    {
      y: 0,
      opacity: 1,
      duration: 1,
      stagger: options?.stagger ?? 0.15,
      ease: "power3.out",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top 85%",
        end: "bottom 20%",
        toggleActions: "play none none none",
      },
    }
  );
}

/** Clip reveal: element reveals from left to right */
export function clipReveal(
  trigger: string | Element,
  targets: string | Element | Element[]
) {
  return gsap.fromTo(
    targets,
    { clipPath: "inset(0 100% 0 0)" },
    {
      clipPath: "inset(0 0% 0 0)",
      duration: 1.2,
      ease: "power4.inOut",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top 80%",
        toggleActions: "play none none none",
      },
    }
  );
}

/** Slide in from left */
export function slideLeft(
  trigger: string | Element,
  targets: string | Element | Element[],
  options?: { x?: number }
) {
  return gsap.fromTo(
    targets,
    { x: options?.x ?? -100, opacity: 0 },
    {
      x: 0,
      opacity: 1,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top 80%",
        toggleActions: "play none none none",
      },
    }
  );
}

/** Slide in from right */
export function slideRight(
  trigger: string | Element,
  targets: string | Element | Element[],
  options?: { x?: number }
) {
  return gsap.fromTo(
    targets,
    { x: options?.x ?? 100, opacity: 0 },
    {
      x: 0,
      opacity: 1,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top 80%",
        toggleActions: "play none none none",
      },
    }
  );
}

/** Scale up: elements scale from small to full */
export function scaleUp(
  trigger: string | Element,
  targets: string | Element | Element[]
) {
  return gsap.fromTo(
    targets,
    { scale: 0.8, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top 85%",
        toggleActions: "play none none none",
      },
    }
  );
}

/** Parallax: element moves at different scroll speed */
export function parallax(
  trigger: string | Element,
  targets: string | Element | Element[],
  speed: number = 0.3
) {
  return gsap.to(targets, {
    y: () => -speed * 200,
    ease: "none",
    scrollTrigger: {
      trigger: trigger as gsap.DOMTarget,
      start: "top bottom",
      end: "bottom top",
      scrub: true,
    },
  });
}

/** Text line reveal: each line slides up from below */
export function lineReveal(
  trigger: string | Element,
  lines: string | Element | Element[]
) {
  return gsap.fromTo(
    lines,
    { y: "110%", opacity: 0 },
    {
      y: "0%",
      opacity: 1,
      duration: 0.8,
      stagger: 0.1,
      ease: "power4.out",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top 85%",
        toggleActions: "play none none none",
      },
    }
  );
}

/** Fade overlay: overlay fades based on scroll */
export function fadeOverlay(
  trigger: string | Element,
  target: string | Element
) {
  return gsap.fromTo(
    target,
    { opacity: 0 },
    {
      opacity: 1,
      ease: "none",
      scrollTrigger: {
        trigger: trigger as gsap.DOMTarget,
        start: "top center",
        end: "bottom center",
        scrub: true,
      },
    }
  );
}

/** Counter animation */
export function counterUp(
  trigger: string | Element,
  target: Element,
  endValue: number
) {
  const obj = { val: 0 };
  return gsap.to(obj, {
    val: endValue,
    duration: 2,
    ease: "power2.out",
    scrollTrigger: {
      trigger: trigger as gsap.DOMTarget,
      start: "top 80%",
      toggleActions: "play none none none",
    },
    onUpdate: () => {
      target.textContent = Math.round(obj.val).toString();
    },
  });
}
