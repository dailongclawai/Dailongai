"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { contactInfo } from "@/data/siteData";
import type { BlogArticleCard } from "@/lib/blog";

const videoLibrary = [
  {
    id: "zhidun-short-2026",
    category: "Mới",
    title: "Ánh sáng đỏ 650nm Cửa sổ vàng của tế bào cơ thể",
    image: "https://i.ytimg.com/vi/i-MwS6ERYJI/hqdefault.jpg",
    youtubeId: "i-MwS6ERYJI",
  },
  {
    id: "zhidun-loi-ich",
    category: "Công dụng",
    title: "ZhiDun lợi ích và công dụng laser 650nm",
    image: "https://i.ytimg.com/vi/LjwgNdnKIGc/maxresdefault.jpg",
    youtubeId: "LjwgNdnKIGc",
  },
  {
    id: "testimonial",
    category: "Khách hàng",
    title: "Hướng dẫn sử dụng máy ZhiDun CEO",
    image: "https://i.ytimg.com/vi/mSNff8wZ4ck/maxresdefault.jpg",
    youtubeId: "mSNff8wZ4ck",
  },
];

type PaginationItem = number | "ellipsis";

function getPaginationItems(
  currentPage: number,
  totalPages: number
): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: PaginationItem[] = [1];
  if (currentPage > 3) items.push("ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) items.push(i);
  if (currentPage < totalPages - 2) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

function readingTime(wordCount?: number): string {
  if (!wordCount) return "3 phút đọc";
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} phút đọc`;
}

const FALLBACK_IMAGE = "/images/sp-1.webp";

export default function BlogContent({
  pageSize = 12,
  featuredArticles = [],
  dynamicArticles = [],
}: {
  pageSize?: number;
  featuredArticles?: (BlogArticleCard & { word_count?: number })[];
  dynamicArticles?: (BlogArticleCard & { word_count?: number })[];
}) {
  const { t } = useI18n();
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    window.dispatchEvent(new Event(playingVideo ? "blog-video:open" : "blog-video:close"));
  }, [playingVideo]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [listPage, setListPage] = useState<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
      setListPage(1);
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const allArticles = [...featuredArticles, ...dynamicArticles];
  const categoryOptions = [
    "all",
    ...Array.from(new Set(allArticles.map((a) => a.category))),
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isFiltering = activeCategory !== "all" || normalizedQuery !== "";

  const matchesFilter = (article: BlogArticleCard) => {
    if (activeCategory !== "all" && article.category !== activeCategory)
      return false;
    if (normalizedQuery) {
      const haystack =
        `${article.title} ${article.excerpt} ${article.category}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  };

  const filteredAll = allArticles.filter(matchesFilter);
  const gridPool = isFiltering ? filteredAll : dynamicArticles;
  const totalGridItems = gridPool.length;
  const totalGridPages = Math.max(1, Math.ceil(totalGridItems / pageSize));
  const activeGridPage = Math.min(listPage, totalGridPages);
  const visibleArticles = gridPool.slice(
    (activeGridPage - 1) * pageSize,
    activeGridPage * pageSize
  );
  const paginationItems = getPaginationItems(activeGridPage, totalGridPages);
  const canGoPrev = activeGridPage > 1;
  const canGoNext = activeGridPage < totalGridPages;

  const handleSelectCategory = (cat: string) => {
    setActiveCategory(cat);
    setListPage(1);
  };

  return (
    <main className="pt-28 sm:pt-36 bg-background min-h-screen">
      {/* ═══════════════════════════════════════════════
          Section 1: Hero Compact + Integrated Filter
          ═══════════════════════════════════════════════ */}
      <section className="relative px-5 sm:px-12 pb-10 sm:pb-14">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,86,37,0.06),transparent_60%)]" />
        </div>

        <div className="relative z-10 max-w-screen-2xl mx-auto">
          {/* Badge + Title + Description */}
          <div className="text-center mb-10 sm:mb-12">
            <span className="inline-block px-4 py-1.5 bg-surface-high text-primary-container font-headline text-[10px] tracking-[0.2em] uppercase mb-5 border border-primary-container/20">
              {t("blog.hub_label") || "KIẾN THỨC SỨC KHOẺ"}
            </span>
            <h1 className="text-[clamp(2.2rem,6vw,4.5rem)] font-headline font-bold leading-[0.95] tracking-tighter text-on-surface mb-4">
              {t("blog.hero_title_1")}{" "}
              <span className="text-gradient">{t("blog.hero_title_2")}</span>
            </h1>
            <p className="text-sm sm:text-base text-secondary max-w-xl mx-auto leading-relaxed">
              {t("blog.hero_desc")}
            </p>
          </div>

          {/* Integrated Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5 bg-surface-low border border-outline-variant/10 rounded-2xl">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
              <svg
                className="w-4 h-4 text-primary-container shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <div className="flex gap-2">
                {categoryOptions.map((cat: string) => {
                  const isActive = cat === activeCategory;
                  const label = cat === "all" ? t("blog.cat_all") : cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold font-headline whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-primary-container text-on-primary"
                          : "bg-surface-high text-secondary hover:text-on-surface"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="relative w-full sm:w-56">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                className="w-full bg-surface-highest border border-outline-variant/10 rounded-full py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container/30 transition-all"
                placeholder={t("blog.search_placeholder")}
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          Section 2: Featured Spotlight (Bento Grid)
          ═══════════════════════════════════════════════ */}
      {!isFiltering && featuredArticles.length > 0 && (
        <section className="max-w-screen-2xl mx-auto px-5 sm:px-12 mb-16 sm:mb-24">
          <div className="flex justify-between items-end mb-6 sm:mb-10">
            <h2 className="text-xl sm:text-3xl font-headline font-bold tracking-tight">
              {t("blog.featured")}
            </h2>
            <div className="h-[1px] flex-grow mx-4 sm:mx-8 bg-outline-variant/20 hidden md:block" />
            <p className="text-secondary font-headline text-xs tracking-widest uppercase hidden sm:block">
              {featuredArticles.length} {t("blog.articles_count")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
            {/* Main Large Card */}
            <a
              href={`/blog/${featuredArticles[0].slug}`}
              className="md:col-span-8 group relative overflow-hidden rounded-2xl border border-primary-container/20 flex flex-col justify-end min-h-[380px] sm:min-h-[520px] hover:border-primary-container/40 transition-all duration-500 no-underline"
            >
              <div className="absolute inset-0 z-0 scale-105 group-hover:scale-100 transition-transform duration-700">
                <img
                  alt={featuredArticles[0].title}
                  className="w-full h-full object-cover opacity-50"
                  src={
                    featuredArticles[0].featured_image || FALLBACK_IMAGE
                  }
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
              </div>
              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-primary-container text-on-primary text-[10px] font-bold uppercase tracking-wider font-headline">
                    {featuredArticles[0].category}
                  </span>
                  <span className="text-[11px] text-secondary/80 font-headline flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {readingTime(
                      (featuredArticles[0] as BlogArticleCard & { word_count?: number }).word_count
                    )}
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold mb-3 sm:mb-4 max-w-2xl leading-tight">
                  {featuredArticles[0].title}
                </h3>
                <p className="text-sm sm:text-base text-secondary mb-5 max-w-xl line-clamp-2">
                  {featuredArticles[0].excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-secondary/60 font-headline">
                    Đại Long Medical • {featuredArticles[0].date}
                  </span>
                  <span className="flex items-center gap-2 text-primary-container font-bold tracking-tight group-hover:gap-4 transition-all font-headline text-sm">
                    {t("blog.read_article")}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </a>

            {/* Vertical Cards with Thumbnails */}
            <div className="md:col-span-4 flex flex-col gap-5 sm:gap-6">
              {featuredArticles.slice(1).map((article) => (
                <a
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="flex-1 group rounded-2xl glass-panel border border-outline-variant/10 overflow-hidden flex flex-col hover:border-primary-container/20 transition-all no-underline"
                >
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-[16/9] overflow-hidden">
                    <img
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={article.featured_image || FALLBACK_IMAGE}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container to-transparent opacity-40" />
                  </div>
                  {/* Content */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
                    <div>
                      <span className="text-[10px] text-primary-container font-headline font-bold tracking-widest mb-2 block uppercase">
                        {article.category}
                      </span>
                      <h4 className="text-base sm:text-lg font-headline font-bold leading-snug line-clamp-2">
                        {article.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10">
                      <span className="text-[10px] text-secondary/60 font-headline">
                        {article.date}
                      </span>
                      <span className="text-[10px] text-secondary/60 font-headline flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {readingTime(
                          (article as BlogArticleCard & { word_count?: number }).word_count
                        )}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Section 3: Video Library (Compact)
          ═══════════════════════════════════════════════ */}
      <section className="bg-[#0c0e10] py-14 sm:py-20">
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-4">
            <div>
              <h2 className="text-xl sm:text-3xl font-headline font-bold mb-2">
                {t("blog.video_title")}
              </h2>
              <p className="text-secondary text-sm">
                {t("blog.video_desc")}
              </p>
            </div>
            {videoLibrary.length < 3 && (
              <span className="text-[11px] text-secondary/50 font-headline tracking-wide">
                {t("blog.coming_soon") || "Thêm video sắp ra mắt"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-8">
            {videoLibrary.map((video) => (
              <div
                key={video.id}
                onClick={() => {
                  if (video.youtubeId) {
                    setPlayingVideo(video.youtubeId);
                  } else {
                    window.open(contactInfo.zalo, "_blank");
                  }
                }}
                className="group relative overflow-hidden rounded-2xl aspect-[4/3] bg-surface-container border border-outline-variant/10 cursor-pointer hover:border-primary-container/20 transition-all"
              >
                <img
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60"
                  src={video.image}
                  loading="lazy"
                  decoding="async"
                />
                {/* Play button — bottom-left to avoid covering faces */}
                <div className="absolute bottom-14 left-4 sm:left-5">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary-container/90 text-on-primary flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                    <svg
                      className="w-5 h-5 ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {/* Info overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-background via-background/80 to-transparent">
                  <p className="text-[10px] font-bold text-primary-container mb-1 uppercase tracking-widest font-headline">
                    {video.category}
                  </p>
                  <h5 className="text-sm sm:text-base font-headline font-bold line-clamp-2">
                    {video.title}
                  </h5>
                </div>
              </div>
            ))}
          </div>

          {/* YouTube Video Modal */}
          {playingVideo && (
            <div
              className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 sm:p-8"
              onClick={() => setPlayingVideo(null)}
            >
              <div
                className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${playingVideo}?autoplay=1&rel=0`}
                  title="Video"
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
                <button
                  onClick={() => setPlayingVideo(null)}
                  className="absolute -top-12 right-0 sm:top-3 sm:right-3 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          Section 4: All Articles Grid (Upgraded Cards)
          ═══════════════════════════════════════════════ */}
      <section className="max-w-screen-2xl mx-auto px-5 sm:px-12 py-16 sm:py-24">
        <div className="flex justify-between items-end mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-3xl font-headline font-bold tracking-tight">
            {t("blog.all_articles")}
          </h2>
          <div className="h-[1px] flex-grow mx-4 sm:mx-8 bg-outline-variant/20 hidden md:block" />
          <p className="text-secondary font-headline text-xs tracking-widest uppercase hidden sm:block">
            {totalGridItems} {t("blog.articles_count")}
          </p>
        </div>

        {visibleArticles.length === 0 && (
          <div className="text-center py-16 text-secondary text-sm">
            {t("blog.empty")}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {visibleArticles.map((article) => (
            <a
              key={article.id}
              href={`/blog/${article.slug}`}
              className="group rounded-2xl glass-panel border border-outline-variant/10 overflow-hidden flex flex-col hover:border-primary-container/20 transition-all duration-300 no-underline"
            >
              {/* Thumbnail with category overlay */}
              <div className="relative w-full aspect-[16/9] overflow-hidden">
                <img
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  src={article.featured_image || FALLBACK_IMAGE}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container/60 to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 bg-primary-container text-on-primary text-[9px] font-bold uppercase tracking-wider font-headline rounded-sm">
                  {article.category}
                </span>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6 flex flex-col flex-1">
                <h3 className="text-base sm:text-lg font-headline font-bold leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-xs sm:text-sm text-secondary line-clamp-2 mb-auto">
                  {article.excerpt}
                </p>

                {/* Footer: author + date | reading time */}
                <div className="mt-4 pt-3 border-t border-outline-variant/10 flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-secondary/60 font-headline">
                    Đại Long Medical • {article.date}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-secondary/60 font-headline flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {readingTime(
                      (article as BlogArticleCard & { word_count?: number }).word_count
                    )}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Pagination */}
        {totalGridPages > 1 && (
          <nav
            aria-label={t("blog.pagination_label")}
            className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          >
            <button
              type="button"
              onClick={() =>
                canGoPrev && setListPage((page) => Math.max(1, page - 1))
              }
              disabled={!canGoPrev}
              className="rounded-full border border-outline-variant/20 px-4 py-2 text-xs font-headline font-bold text-on-surface transition-all disabled:cursor-not-allowed disabled:opacity-35 hover:border-primary-container/30 hover:bg-surface-bright"
            >
              {t("blog.prev_page")}
            </button>

            {paginationItems.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-sm text-secondary/50"
                  >
                    ...
                  </span>
                );
              }
              const isActive = item === activeGridPage;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setListPage(item)}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-w-10 rounded-full border px-4 py-2 text-center text-xs font-headline font-bold transition-all ${
                    isActive
                      ? "border-primary-container bg-primary-container text-on-primary"
                      : "border-outline-variant/20 text-on-surface hover:border-primary-container/30 hover:bg-surface-bright"
                  }`}
                >
                  {item}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                canGoNext &&
                setListPage((page) => Math.min(totalGridPages, page + 1))
              }
              disabled={!canGoNext}
              className="rounded-full border border-outline-variant/20 px-4 py-2 text-xs font-headline font-bold text-on-surface transition-all disabled:cursor-not-allowed disabled:opacity-35 hover:border-primary-container/30 hover:bg-surface-bright"
            >
              {t("blog.next_page")}
            </button>
          </nav>
        )}
      </section>

      {/* ═══════════════════════════════════════════════
          Section 5: CTA Conversion Banner
          ═══════════════════════════════════════════════ */}
      <section className="max-w-screen-2xl mx-auto px-5 sm:px-12 pb-20 sm:pb-28">
        <div className="relative overflow-hidden rounded-3xl border border-primary-container/20 bg-surface-low">
          {/* Decorative glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(255,86,37,0.08),transparent_70%)]" />
          </div>

          <div className="relative z-10 px-8 sm:px-14 py-12 sm:py-16 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 sm:gap-10">
            {/* Left: Text */}
            <div className="max-w-lg">
              <span className="inline-block px-3 py-1 bg-primary-container/15 text-primary-container text-[10px] font-bold uppercase tracking-widest font-headline mb-4 border border-primary-container/20 rounded-sm">
                {t("blog.cta_badge") || "TƯ VẤN MIỄN PHÍ"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight mb-3">
                {t("blog.cta_heading") || "Cần tư vấn về laser trị liệu?"}
              </h2>
              <p className="text-sm sm:text-base text-secondary leading-relaxed">
                {t("blog.cta_desc") ||
                  "Đội ngũ chuyên gia Đại Long sẵn sàng giải đáp mọi thắc mắc về sản phẩm và phương pháp laser trị liệu."}
              </p>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col gap-3 sm:min-w-[260px]">
              <a
                href={contactInfo.zalo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-7 py-3.5 bg-primary-container text-on-primary font-headline font-bold text-sm rounded-full hover:brightness-110 transition-all no-underline"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 48 48"
                  fill="currentColor"
                >
                  <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm8.844 27.328c-.516 1.609-2.625 2.953-4.406 3.344-.484.109-1.109.188-1.609.188-1.219 0-2.812-.375-5.469-1.594-3.375-1.547-5.906-4.219-7.656-6.656-.094-.109-.172-.234-.266-.344-1.219-1.688-1.938-3.609-1.938-5.578 0-2.484 1.031-4.031 1.688-4.828.656-.797 1.547-1.172 2.297-1.172.281 0 .547.047.781.125.656.234 1.078.672 1.453 1.453.094.188.203.391.328.625.375.703.844 1.578 1.078 2.016.375.703.156 1.484-.344 1.906l-.453.344c-.375.281-.703.531-.297 1.078.422.578 1.828 2.578 3.891 3.984 1.547 1.047 2.797 1.453 3.391 1.672.547.203.875-.063 1.203-.453.328-.391.703-.906 1.078-1.406.266-.359.594-.406.922-.297.344.109 2.172 1.016 2.547 1.203.375.188.625.281.719.438.109.172.109.969-.406 2.578z" />
                </svg>
                Chat Zalo ngay
              </a>
              <a
                href={`tel:${contactInfo.hotline.replace(/\s/g, "")}`}
                className="flex items-center justify-center gap-2.5 px-7 py-3.5 border border-outline-variant/30 text-on-surface font-headline font-bold text-sm rounded-full hover:bg-surface-high transition-all no-underline"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                {contactInfo.hotline}
              </a>
              <p className="text-[11px] text-secondary/50 text-center font-headline tracking-wide">
                Kết nối với AI Meo Meo • Trả lời ngay
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
