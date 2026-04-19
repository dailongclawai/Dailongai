import SmoothScroll from "@/components/SmoothScroll";
import Header from "@/components/Header";
import ProductPage from "@/components/ProductPage";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZhiDun CEO | Máy Laser Trị liệu — Đặt hàng",
  description:
    "Mua máy laser trị liệu ZhiDun CEO chính hãng. Bước sóng 650nm, bảo hành 5 năm. Giá 29.500.000đ.",
};

export default function SanPham() {
  return (
    <SmoothScroll>
      <Header />
      <ZaloButton />
      <main>
        <ProductPage />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
