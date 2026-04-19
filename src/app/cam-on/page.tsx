import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import ThankYouContent from "./ThankYouContent";

export const metadata: Metadata = {
  title: "Cảm ơn Quý khách | Đại Long MedTech",
  description:
    "Cảm ơn Quý khách đã tin tưởng Đại Long. Chúng tôi sẽ liên hệ tư vấn trong thời gian sớm nhất.",
};

export default function ThankYouPage() {
  return (
    <>
      <Header />
      <ThankYouContent />
      <Footer />
    </>
  );
}
