import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import BlogContent from "./BlogContent";
import {
  BLOG_PAGE_SIZE,
  getFeaturedArticles,
  getNonFeaturedArticles,
  toBlogCard,
} from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | Đại Long — Kiến thức Laser Trị liệu & Sức khỏe",
  description:
    "Khám phá kiến thức chuyên sâu về công nghệ laser trị liệu, nghiên cứu lâm sàng, hướng dẫn sử dụng và chia sẻ từ chuyên gia y tế tại Đại Long.",
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

  return (
    <>
      <Header />
      <ZaloButton />
      <BlogContent
        pageSize={BLOG_PAGE_SIZE}
        featuredArticles={featuredArticles}
        dynamicArticles={dynamicArticles}
      />
      <Footer />
    </>
  );
}
