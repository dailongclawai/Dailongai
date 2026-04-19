import SmoothScroll from "@/components/SmoothScroll";
import Header from "@/components/Header";
import HealthStatsPage from "@/components/HealthStatsPage";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thực trạng Tiểu đường & Huyết áp cao tại Việt Nam | Đại Long",
  description:
    "Số liệu cập nhật về bệnh tiểu đường và huyết áp cao tại Việt Nam — tỷ lệ mắc, xu hướng tăng, nhóm tuổi nguy cơ và giải pháp phòng ngừa.",
};

export default function ThucTrangSucKhoe() {
  return (
    <SmoothScroll>
      <Header />
      <ZaloButton />
      <main>
        <HealthStatsPage />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
