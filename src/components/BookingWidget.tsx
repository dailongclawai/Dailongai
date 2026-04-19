"use client";

import { useEffect, useRef } from "react";

interface CalApi {
  (action: string, options?: Record<string, unknown>): void;
  loaded?: boolean;
  q?: unknown[];
  ns?: Record<string, CalApi>;
}

declare global {
  interface Window {
    Cal?: CalApi;
  }
}

interface Props {
  calLink: string;
  origin?: string;
  layout?: "month_view" | "week_view" | "column_view";
  hideEventTypeDetails?: boolean;
  className?: string;
}

export default function BookingWidget({
  calLink,
  origin = process.env.NEXT_PUBLIC_CAL_ORIGIN || "https://cal.dailongai.com",
  layout = "month_view",
  hideEventTypeDetails = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const namespace = "dailong-booking";
    if (!window.Cal) {
      const init = function (this: unknown, ...args: unknown[]) {
        const cal = window.Cal as CalApi;
        const p = function (this: unknown, ...inner: unknown[]) {
          (cal.q = cal.q || []).push(inner);
        } as unknown as CalApi;
        cal.ns = cal.ns || {};
        if (typeof args[0] === "string" && args[0]) {
          const ns = args[0] as string;
          cal.ns[ns] = cal.ns[ns] || (p as unknown as CalApi);
          (cal.ns[ns].q = cal.ns[ns].q || []).push(args.slice(1));
        } else {
          (cal.q = cal.q || []).push(args);
        }
      } as unknown as CalApi;
      window.Cal = init;
      const script = document.createElement("script");
      script.src = `${origin}/embed/embed.js`;
      script.async = true;
      document.head.appendChild(script);
    }

    window.Cal!("init", { origin, namespace });
    window.Cal!.ns?.[namespace]?.("inline", {
      elementOrSelector: ref.current,
      calLink,
      layout,
      config: { hideEventTypeDetails: hideEventTypeDetails ? "1" : "0" },
    });
    window.Cal!.ns?.[namespace]?.("ui", {
      hideEventTypeDetails,
      layout,
      theme: "dark",
    });
  }, [calLink, origin, layout, hideEventTypeDetails]);

  return <div ref={ref} className={className ?? "min-h-[600px] w-full"} />;
}
