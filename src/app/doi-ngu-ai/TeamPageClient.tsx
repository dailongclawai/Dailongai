"use client";

import BossTierSection from "./components/BossTierSection";
import MarqueeSection from "./components/MarqueeSection";
import DepartmentGridSection from "./components/DepartmentGridSection";
import DataInfraSection from "./components/DataInfraSection";
import AboutSection from "./components/AboutSection";
import CtaSection from "./components/CtaSection";
import { useI18n } from "@/lib/i18n";

export default function TeamPageClient() {
  const { t } = useI18n();
  return (
    <>
      <div className="scanline-overlay" aria-hidden="true" />
      <div className="side-nav" aria-hidden="true">
        <div className="side-nav-bar" />
        <div className="side-nav-text">
          <span>{t("team.sidenav.phase")}</span>
          <span className="active">{t("team.sidenav.status")}</span>
        </div>
      </div>

      <BossTierSection />
      <MarqueeSection />
      <DepartmentGridSection />
      <DataInfraSection />
      <AboutSection />
      <CtaSection />
    </>
  );
}
