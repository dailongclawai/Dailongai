"use client";

import FadeIn from "./FadeIn";
import { useI18n } from "@/lib/i18n";

export default function CtaSection() {
  const { t } = useI18n();
  return (
    <section className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
      <FadeIn delay={0} y={40}>
        <div
          className="relative overflow-hidden rounded-2xl p-8 md:p-12"
          style={{
            background: "#131316",
            border: "1px solid rgba(72, 71, 75, 0.2)",
          }}
        >
          <div
            className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full pointer-events-none"
            style={{
              background: "rgba(255, 144, 105, 0.15)",
              filter: "blur(100px)",
            }}
          />
          <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2
                className="font-extrabold tracking-tighter mb-6 uppercase"
                style={{
                  color: "#f0edf1",
                  fontSize: "clamp(2rem, 4.5vw, 3rem)" as string,
                  lineHeight: 1.05,
                }}
              >
                {t("team.cta.heading")}
              </h2>
              <p
                className="mb-8 leading-relaxed"
                style={{
                  color: "#acaaae",
                  fontSize: "clamp(0.95rem, 1.4vw, 1.1rem)" as string,
                }}
              >
                {t("team.cta.body")}
              </p>
              <a
                href="/lien-he"
                className="contact-btn inline-block px-10 py-4 text-sm md:text-base"
              >
                {t("team.cta.button")}
              </a>
            </div>
            <div
              className="relative h-64 rounded-2xl overflow-hidden group"
              style={{ border: "1px solid rgba(72, 71, 75, 0.3)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Đại Long AI fleet"
                src="/images/team/ha-tang.png"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "grayscale(0.6) opacity(0.7)",
                  transition: "filter 0.7s",
                }}
                className="group-hover:[filter:grayscale(0)_opacity(0.95)]"
              />
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
