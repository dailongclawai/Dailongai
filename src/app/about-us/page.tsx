import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import AboutUsContent from "./AboutUsContent";

export const metadata: Metadata = {
  title: "Về chúng tôi | Đại Long — Phân phối ZhiDun CEO chính hãng",
  description:
    "Tìm hiểu về Công ty TNHH Công nghệ và Y tế Đại Long — đơn vị phân phối độc quyền thiết bị laser trị liệu ZhiDun CEO tại Việt Nam.",
};

export default function AboutUsPage() {
  return (
    <>
    <Header />
    <ZaloButton />
    <AboutUsContent />
    <Footer />
    </>
  );
}
