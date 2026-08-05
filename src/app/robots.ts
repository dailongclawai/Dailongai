import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["OAI-SearchBot", "GPTBot", "Bingbot", "PerplexityBot", "ClaudeBot", "Google-Extended"],
        allow: "/",
        disallow: ["/api/", "/_next/", "/images/_responsive/"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/images/_responsive/"],
      },
    ],
    host: "https://dailongai.com",
    sitemap: "https://dailongai.com/sitemap.xml",
  };
}
