import type { Metadata } from "next";
import SmoothScroll from "@/components/SmoothScroll";
import Header from "@/components/Header";
import ZaloButton from "@/components/ZaloButton";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Tư vấn máy laser trị liệu Đại Long | Lipid Shield bảo hành 5 năm",
  description:
    "Để lại thông tin để nhận tư vấn miễn phí về máy laser trị liệu (laser bán dẫn) Lipid Shield — giấy phép thiết bị y tế TBYT 260001468/PCBB-HN, bảo hành chính hãng 5 năm.",
  alternates: { canonical: "/tu-van" },
};

const trustPoints = [
  "Giấy phép thiết bị y tế số TBYT 260001468/PCBB-HN do Sở Y tế Hà Nội cấp.",
  "Lipid Shield bảo hành chính hãng 5 năm.",
  "Showroom trải nghiệm trực tiếp tại Hà Nội và TP. Hồ Chí Minh, tư vấn qua hotline hoặc Zalo.",
];

export default function TuVan() {
  return (
    <SmoothScroll>
      <Header />
      <ZaloButton />
      <main>
        <section className="pt-32 sm:pt-40 pb-16 sm:pb-20 px-5 sm:px-8 lg:px-12 2xl:px-20 max-w-screen-2xl mx-auto">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-headline tracking-tighter leading-[0.95] text-on-surface mb-6">
              Nhận tư vấn máy laser trị liệu Đại Long
            </h1>
            <p className="text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
              Để lại thông tin, đội ngũ Đại Long - công nghệ chăm sóc sức khoẻ sẽ liên hệ tư vấn miễn phí về máy laser trị liệu (laser bán dẫn) Lipid Shield phù hợp với nhu cầu của Quý khách.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-10 sm:mt-12">
            {trustPoints.map((point) => (
              <div key={point} className="glass-panel rounded-xl p-5 sm:p-6 border-l-2 border-primary/40">
                <p className="text-on-surface text-xs sm:text-sm leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <ContactForm source="tu-van" />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
