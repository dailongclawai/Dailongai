#!/usr/bin/env node
/**
 * Convert content/blog/*.json → content/blog/*.mdx
 * - Frontmatter: title, slug, category, date, author, meta_description, featured_image, word_count, excerpt
 * - Body: raw HTML preserved (MDX accepts inline HTML if no JSX needed)
 *
 * Run: node scripts/blog-json-to-mdx.mjs
 *
 * Safe to run repeatedly — skips if .mdx already exists for that slug.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BLOG_DIR = join(ROOT, "content/blog");

function escape(value) {
  if (value == null) return "";
  return String(value).replace(/"/g, '\\"');
}

const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith(".json"));
let converted = 0;
let skipped = 0;

for (const file of files) {
  const slug = file.replace(/\.json$/, "");
  const mdxPath = join(BLOG_DIR, `${slug}.mdx`);
  try {
    await stat(mdxPath);
    skipped++;
    continue;
  } catch {
    /* mdx not present, proceed */
  }

  const article = JSON.parse(await readFile(join(BLOG_DIR, file), "utf8"));
  const fm = [
    "---",
    `title: "${escape(article.title)}"`,
    `slug: "${escape(article.slug)}"`,
    `category: "${escape(article.category)}"`,
    `date: "${escape(article.date)}"`,
    `author: "${escape(article.author)}"`,
    `meta_description: "${escape(article.meta_description)}"`,
    article.featured_image ? `featured_image: "${escape(article.featured_image)}"` : null,
    `word_count: ${Number(article.word_count) || 0}`,
    `excerpt: "${escape(article.excerpt)}"`,
    article.featured ? `featured: true` : null,
    "---",
    "",
  ].filter(Boolean).join("\n");

  const body = (article.content || "").trim();
  await writeFile(mdxPath, `${fm}\n${body}\n`, "utf8");
  console.log(`✓ ${slug}.mdx`);
  converted++;
}

console.log(`\nDone. Converted ${converted}, skipped ${skipped}.`);
