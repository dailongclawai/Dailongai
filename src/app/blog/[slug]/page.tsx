import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import { getAllSlugs, getArticleBySlug } from "@/lib/blog";
import { sanitizeHtml } from "@/lib/sanitize";
import { notFound } from "next/navigation";
import { contactInfo } from "@/data/siteData";

export const dynamicParams = false;
const EMPTY_BLOG_SENTINEL = "__empty__";

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return (slugs.length ? slugs : [EMPTY_BLOG_SENTINEL]).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === EMPTY_BLOG_SENTINEL) return { title: "Blog Đại Long" };
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Bài viết không tồn tại" };
  return {
    title: `${article.title} | Blog Đại Long`,
    description: article.meta_description,
    openGraph: {
      title: article.title,
      description: article.meta_description,
      type: "article",
      locale: "vi_VN",
      url: `https://dailongai.com/blog/${article.slug}`,
      images: article.featured_image ? [{ url: article.featured_image }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === EMPTY_BLOG_SENTINEL) notFound();
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const formattedDate = new Date(article.date).toLocaleDateString("vi-VN", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <Header />
      <ZaloButton />
      <main className="pt-28 sm:pt-36 pb-20 sm:pb-32 bg-background min-h-screen">
        <article data-pagefind-body data-pagefind-meta={`title:${article.title}`} className="max-w-3xl mx-auto px-5 sm:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[10px] text-secondary mb-6">
            <a href="/" className="hover:text-primary transition-colors">Trang chủ</a>
            <span className="text-secondary/30">/</span>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            <span className="text-secondary/30">/</span>
            <span className="text-primary font-bold truncate max-w-[200px]">{article.title}</span>
          </div>

          {/* Category + Date */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary-container text-on-primary text-[10px] font-bold uppercase tracking-wider font-headline">
              {article.category}
            </span>
            <span className="text-xs text-secondary">{formattedDate}</span>
            <span className="text-xs text-secondary">{article.word_count} từ</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline tracking-tighter leading-[1.1] text-on-surface mb-6">
            {article.title}
          </h1>

          {/* Meta description */}
          <p className="text-lg text-secondary leading-relaxed mb-8 border-l-2 border-primary/30 pl-4">
            {article.meta_description}
          </p>

          {/* Featured image */}
          {article.featured_image && (
            <div className="rounded-2xl overflow-hidden mb-10 border border-white/5">
              <img
                src={article.featured_image}
                alt={article.title}
                className="w-full h-auto object-cover"
                loading="eager"
              />
            </div>
          )}

          {/* Content */}
          <div
            className="blog-content prose prose-invert prose-lg max-w-none
              prose-headings:font-headline prose-headings:tracking-tight prose-headings:text-on-surface
              prose-h2:text-2xl prose-h2:sm:text-3xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-secondary prose-p:leading-relaxed prose-p:mb-4
              prose-li:text-secondary prose-li:leading-relaxed
              prose-ul:my-4 prose-ul:pl-4
              prose-strong:text-on-surface
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
          />

          {/* CTA */}
          <div className="mt-16 p-8 rounded-2xl bg-surface-low border border-primary/10 text-center">
            <h3 className="text-xl font-headline font-bold mb-3">Tìm hiểu thêm về ZhiDun CEO</h3>
            <p className="text-secondary text-sm mb-6">Liên hệ đội ngũ tư vấn Đại Long để được hỗ trợ chi tiết</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="/#contact" className="bg-primary-container text-on-primary px-6 py-3 font-headline font-bold text-xs tracking-[0.1em] uppercase">
                TƯ VẤN NGAY
              </a>
              <a href={`tel:${contactInfo.hotline.replace(/\s/g, "")}`} className="border border-outline-variant text-on-surface px-6 py-3 font-headline font-bold text-xs tracking-[0.1em] uppercase hover:bg-surface-high transition-all">
                GỌI {contactInfo.hotline}
              </a>
            </div>
          </div>

          {/* Author */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">ĐL</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{article.author}</p>
              <p className="text-xs text-secondary">{formattedDate}</p>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
