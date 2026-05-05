import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import Scene3D from "./Scene3D";
import "./styles.css";

export const metadata: Metadata = {
  title: "Đội Ngũ AI | Đại Long Medical",
  description:
    "18 thành viên · 1 tầm nhìn — Đội ngũ AI fleet của Đại Long Medical: Boss + 17 Sen Agent vận hành 24/7 trong không gian 3D Apple Vision Pro style.",
};

export default function DoiNguAiPage() {
  return (
    <div className="team-page-3d">
      <Header />
      <ZaloButton />
      <Scene3D />
      <Footer />
    </div>
  );
}
