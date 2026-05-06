import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import TeamPageClient from "./TeamPageClient";
import "./styles.css";

export const metadata: Metadata = {
  title: "Đội Ngũ AI | Đại Long Medical",
  description:
    "18 thành viên · 1 tầm nhìn — Hạm đội AI của Đại Long Medical: Boss và 17 Sen Agent vận hành 24/7, từ chăm sóc khách hàng đến vận hành hạ tầng.",
  alternates: { canonical: "/doi-ngu-ai" },
};

export default function DoiNguAiPage() {
  return (
    <div className="team-page-jack">
      <Header />
      <ZaloButton />
      <TeamPageClient />
      <Footer />
    </div>
  );
}
