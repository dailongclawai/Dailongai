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
