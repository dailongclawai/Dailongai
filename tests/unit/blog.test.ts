import { describe, it, expect } from "vitest";
import { getAllArticles, getArticleBySlug, getAllSlugs, toBlogCard, BLOG_PAGE_SIZE } from "@/lib/blog";

describe("blog library", () => {
  it("loads at least one article from content/blog", () => {
    const all = getAllArticles();
    expect(all.length).toBeGreaterThan(0);
  });

  it("articles are sorted newest-first by date", () => {
    const all = getAllArticles();
    for (let i = 1; i < all.length; i++) {
      const prev = new Date(all[i - 1].date).getTime();
      const cur = new Date(all[i].date).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("getArticleBySlug finds an existing slug", () => {
    const slugs = getAllSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    const article = getArticleBySlug(slugs[0]);
    expect(article).not.toBeNull();
    expect(article?.slug).toBe(slugs[0]);
  });

  it("getArticleBySlug returns null for unknown slug", () => {
    expect(getArticleBySlug("does-not-exist-xyz-123")).toBeNull();
  });

  it("toBlogCard formats date in vi-VN", () => {
    const all = getAllArticles();
    const card = toBlogCard(all[0]);
    expect(card.slug).toBe(all[0].slug);
    expect(card.date).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("BLOG_PAGE_SIZE is a positive integer", () => {
    expect(BLOG_PAGE_SIZE).toBeGreaterThan(0);
  });
});
