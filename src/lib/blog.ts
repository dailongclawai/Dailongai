import fs from 'fs'
import path from 'path'

export interface BlogArticle {
  id: string
  title: string
  slug: string
  category: string
  meta_description: string
  featured_image: string | null
  date: string
  author: string
  word_count: number
  seo_keyword: string
  excerpt: string
  content: string
  featured?: boolean
  related_slugs?: string[]
}

export interface BlogArticleCard {
  id: string
  category: string
  title: string
  excerpt: string
  date: string
  slug: string
  featured_image?: string | null
  word_count?: number
}

export const BLOG_PAGE_SIZE = 12

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export function getAllArticles(): BlogArticle[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.json'))
  const articles: BlogArticle[] = []

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8')
      articles.push(JSON.parse(raw))
    } catch { /* skip invalid files */ }
  }

  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getArticleBySlug(slug: string): BlogArticle | null {
  const articles = getAllArticles()
  return articles.find(a => a.slug === slug) || null
}

export function getAllSlugs(): string[] {
  return getAllArticles().map(a => a.slug)
}

export function getFeaturedArticles(): BlogArticle[] {
  return getAllArticles().filter(a => a.featured)
}

export function getNonFeaturedArticles(): BlogArticle[] {
  return getAllArticles().filter(a => !a.featured)
}

export function getRelatedArticles(slug: string, limit = 6): BlogArticle[] {
  const all = getAllArticles().filter(a => a.slug !== slug && !/-\d{10,}$/.test(a.slug))
  const current = getArticleBySlug(slug)
  const bySlug = new Map(all.map(a => [a.slug, a]))
  // Editorial topical links first (related_slugs), then fill by recency.
  const curated = (current?.related_slugs || [])
    .map(s => bySlug.get(s))
    .filter((a): a is BlogArticle => Boolean(a))
  const seen = new Set<string>()
  const ordered = [...curated, ...all].filter(a => {
    if (seen.has(a.slug)) return false
    seen.add(a.slug)
    return true
  })
  return ordered.slice(0, limit)
}

export function toBlogCard(article: BlogArticle): BlogArticleCard {
  return {
    id: article.slug,
    category: article.category,
    title: article.title,
    excerpt: article.excerpt,
    date: new Date(article.date).toLocaleDateString('vi-VN'),
    slug: article.slug,
    featured_image: article.featured_image,
    word_count: article.word_count,
  }
}
