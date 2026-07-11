import SmoothScroll from "@/components/SmoothScroll";
import Header from "@/components/Header";
import ProductPage from "@/components/ProductPage";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lipid Shield | Máy Laser Trị liệu — Đặt hàng",
  description:
    "Mua máy laser trị liệu Lipid Shield chính hãng. Bước sóng 650nm, bảo hành 5 năm. Giá 29.500.000đ.",
  alternates: { canonical: "/san-pham" },
};

export default function SanPham() {
  return (
    <SmoothScroll>
      <Header />
      <ZaloButton />
      <main>
        <ProductPage />
        <ContactForm source="san-pham" />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
