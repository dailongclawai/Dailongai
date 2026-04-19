import SmoothScroll from "@/components/SmoothScroll";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import CertificationsSection from "@/components/CertificationsSection";
import SolutionsSection from "@/components/SolutionsSection";
import StatsSection from "@/components/StatsSection";

import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";

export default function Home() {
  return (
    <SmoothScroll>
      <Header />
      <ZaloButton />
      <main>
        <HeroSection />
        <AboutSection />
        <SolutionsSection />
        <CertificationsSection />
        <StatsSection />

        <ContactForm />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
