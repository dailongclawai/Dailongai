import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import BlogContent from "./BlogContent";
import {
  BLOG_PAGE_SIZE,
  getAllArticles,
  getFeaturedArticles,
  getNonFeaturedArticles,
  toBlogCard,
} from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | Đại Long — Kiến thức Laser Trị liệu & Sức khỏe",
  description:
    "Khám phá kiến thức chuyên sâu về công nghệ laser trị liệu, nghiên cứu lâm sàng, hướng dẫn sử dụng và chia sẻ từ chuyên gia y tế tại Đại Long.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | Đại Long — Kiến thức Laser Trị liệu & Sức khỏe",
    description:
      "Khám phá kiến thức chuyên sâu về công nghệ laser trị liệu, nghiên cứu lâm sàng và chia sẻ từ chuyên gia y tế.",
    type: "website",
    locale: "vi_VN",
    url: "https://dailongai.com/blog",
  },
};

export default function BlogPage() {
  const featuredArticles = getFeaturedArticles().map(toBlogCard);
  const dynamicArticles = getNonFeaturedArticles().map(toBlogCard);
  const allArticles = getAllArticles();

  return (
    <>
      <Header />
      <ZaloButton />
      <BlogContent
        pageSize={BLOG_PAGE_SIZE}
        featuredArticles={featuredArticles}
        dynamicArticles={dynamicArticles}
      />
      <nav
        aria-label="Tất cả bài viết"
        className="max-w-screen-2xl mx-auto px-5 sm:px-12 pb-16 sm:pb-24"
      >
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-headline font-bold tracking-tight text-on-surface">
            Tất cả bài viết
          </h2>
          <div className="h-[1px] flex-grow bg-outline-variant/20" />
          <span className="text-secondary font-headline text-xs tracking-widest uppercase">
            {allArticles.length} bài
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5">
          {allArticles.map((article) => (
            <li key={article.slug}>
              <a
                href={`/blog/${article.slug}`}
                className="text-sm text-secondary hover:text-primary-container transition-colors no-underline leading-snug"
              >
                {article.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Footer />
    </>
  );
}
