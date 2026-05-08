import "@testing-library/jest-dom/vitest";

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
