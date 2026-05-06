"use client";

import HeroSection from "./components/HeroSection";
import BossTierSection from "./components/BossTierSection";
import MarqueeSection from "./components/MarqueeSection";
import DepartmentGridSection from "./components/DepartmentGridSection";
import DataInfraSection from "./components/DataInfraSection";
import AboutSection from "./components/AboutSection";
import CtaSection from "./components/CtaSection";

export default function TeamPageClient() {
  return (
    <>
      <div className="scanline-overlay" aria-hidden="true" />
      <div className="side-nav" aria-hidden="true">
        <div className="side-nav-bar" />
        <div className="side-nav-text">
          <span>Phase 04</span>
          <span className="active">Operational</span>
        </div>
      </div>

      <HeroSection />
      <BossTierSection />
      <MarqueeSection />
      <DepartmentGridSection />
      <DataInfraSection />
      <AboutSection />
      <CtaSection />
    </>
  );
}
