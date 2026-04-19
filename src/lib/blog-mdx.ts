import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface MdxArticle {
  slug: string;
  title: string;
  category: string;
  meta_description: string;
  featured_image: string | null;
  date: string;
  author: string;
  word_count: number;
  excerpt: string;
  source: string;
  featured?: boolean;
}

const MDX_DIR = path.join(process.cwd(), "content/blog");

export function getMdxSlugs(): string[] {
  if (!fs.existsSync(MDX_DIR)) return [];
  return fs
    .readdirSync(MDX_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getMdxArticle(slug: string): MdxArticle | null {
  const file = path.join(MDX_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    category: data.category ?? "Sức khỏe",
    meta_description: data.meta_description ?? "",
    featured_image: data.featured_image ?? null,
    date: data.date ?? new Date().toISOString().slice(0, 10),
    author: data.author ?? "Đại Long Medical",
    word_count: data.word_count ?? content.split(/\s+/).length,
    excerpt: data.excerpt ?? "",
    featured: data.featured,
    source: content,
  };
}
