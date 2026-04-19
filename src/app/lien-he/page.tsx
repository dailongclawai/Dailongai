import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "Liên hệ | Đại Long — Tư vấn & Đặt hàng ZhiDun CEO",
  description:
    "Liên hệ Đại Long để được tư vấn và đặt hàng thiết bị laser trị liệu ZhiDun CEO chính hãng. Hotline 0935 999 922.",
};

export default function LienHePage() {
  return (
    <>
      <Header />
      <ZaloButton />
      <ContactPageClient />
      <Footer />
    </>
  );
}
