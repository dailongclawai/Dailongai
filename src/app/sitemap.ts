import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/blog";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://dailongai.com";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/about-us`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/san-pham`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/thuc-trang-suc-khoe`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/lien-he`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  const articles = getAllArticles();
  const blogPages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
