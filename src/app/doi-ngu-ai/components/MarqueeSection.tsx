"use client";

import { useEffect, useRef, useState } from "react";
import { allMembers, departments, pickLang, type Sen } from "../data/agents";
import { useI18n } from "@/lib/i18n";

function deptOf(sen: Sen) {
  return departments.find((d) => d.members.includes(sen))!;
}

const ROW1: Sen[] = allMembers.slice(0, 9);
const ROW2: Sen[] = allMembers.slice(9);

function tileBg(hex: string) {
  return `radial-gradient(circle at 30% 20%, ${hex}33, transparent 60%), linear-gradient(180deg, rgba(20,20,28,0.9), rgba(8,8,14,0.95))`;
}

function Tile({ sen, locale }: { sen: Sen; locale: string }) {
  const dept = deptOf(sen);
  return (
    <div
      className="rounded-2xl overflow-hidden flex-none flex flex-col items-center justify-center p-5"
      style={{
        width: 280,
        height: 280,
        background: tileBg(dept.hex),
        border: `1px solid ${dept.hex}55`,
        boxShadow: `0 0 24px ${dept.hex}22`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/team/${sen.avatar}`}
        alt={sen.name}
        loading="lazy"
        style={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          objectFit: "cover",
          border: `2px solid ${dept.hex}`,
          boxShadow: `0 0 20px ${dept.hex}99`,
        }}
      />
      <div
        style={{
          marginTop: 14,
          fontFamily: "Kanit, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.05em",
          color: "#fff",
          textTransform: "uppercase",
        }}
      >
        {sen.name}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          letterSpacing: "0.15em",
          color: dept.hex,
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {pickLang(sen.role, locale)}
      </div>
    </div>
  );
}

export default function MarqueeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const { locale } = useI18n();

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top + window.scrollY;
      const value = (window.scrollY - sectionTop + window.innerHeight) * 0.3;
      setOffset(value);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const trans = offset - 200;
  const row1 = [...ROW1, ...ROW1, ...ROW1];
  const row2 = [...ROW2, ...ROW2, ...ROW2];

  return (
    <section
      ref={sectionRef}
      className="pt-24 sm:pt-32 md:pt-40 pb-10"
      style={{ background: "#0C0C0C", overflowX: "clip" }}
    >
      <div className="flex flex-col gap-3">
        <div
          className="flex gap-3"
          style={{
            transform: `translateX(${trans}px)`,
            willChange: "transform",
          }}
        >
          {row1.map((s, i) => <Tile key={`r1-${i}`} sen={s} locale={locale} />)}
        </div>
        <div
          className="flex gap-3"
          style={{
            transform: `translateX(${-trans}px)`,
            willChange: "transform",
          }}
        >
          {row2.map((s, i) => <Tile key={`r2-${i}`} sen={s} locale={locale} />)}
        </div>
      </div>
    </section>
  );
}
