import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Default Supabase env so tests using getSupabaseClient don't blow up when
// .env.local isn't loaded (e.g. CI). Real values get overridden by the test
// runner when present.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

// Node.js 25 ships a built-in (but non-functional) global.localStorage stub.
// vitest's populateGlobal skips keys that already exist in the Node global unless
// they are in its KEYS allowlist — so jsdom's Storage never replaces the Node stub.
// We restore jsdom's real Storage object here so Web Storage APIs work in tests.
interface JsdomWindow extends Window {
  jsdom: { window: Window & typeof globalThis };
}

if (typeof window !== "undefined" && (window as Partial<JsdomWindow>).jsdom) {
  const jsdomWindow = (window as unknown as JsdomWindow).jsdom.window;
  Object.defineProperty(globalThis, "localStorage", {
    get: () => jsdomWindow.localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    get: () => jsdomWindow.sessionStorage,
    configurable: true,
  });
}

// @testing-library/dom's asyncWrapper checks `typeof jest !== 'undefined'`
// to gate fake-timer support. Vitest does not provide this global, so we
// alias `jest = vi` here to keep `waitFor` working under `vi.useFakeTimers()`.
(globalThis as typeof globalThis & { jest: typeof vi }).jest = vi;

// jsdom does not implement window.matchMedia; provide a no-op stub so that
// vi.spyOn(window, 'matchMedia') can override it in individual tests.
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
