"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __sentryInit?: boolean;
  }
}

export default function Observability() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn || window.__sentryInit) return;
    window.__sentryInit = true;
    import("@sentry/browser").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENV || "production",
        release: process.env.NEXT_PUBLIC_RELEASE,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.1,
        sendDefaultPii: false,
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Non-Error promise rejection captured",
        ],
      });
    });
  }, []);

  const cfToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!cfToken) return null;
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token":"${cfToken}"}`}
    />
  );
}
