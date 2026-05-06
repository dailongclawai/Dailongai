"use client";

import FadeIn from "./FadeIn";
import { departments, type Sen, type Department } from "../data/agents";

function SenCard({ sen, dept, index }: { sen: Sen; dept: Department; index: number }) {
  return (
    <FadeIn delay={index * 0.06} y={24}>
      <div
        className="group p-6 rounded-2xl flex flex-col items-center text-center transition-all duration-300 cursor-default"
        style={{
          background: "#19191d",
          border: "1px solid rgba(72, 71, 75, 0.2)",
        }}
      >
        <div className="relative mb-5">
          <div
            className="absolute -inset-2 rounded-full blur-md opacity-40 group-hover:opacity-90 transition-opacity duration-500"
            style={{ background: dept.hex }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/images/team/${sen.avatar}`}
            alt={sen.name}
            loading="lazy"
            style={{
              position: "relative",
              width: 96,
              height: 96,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${dept.hex}`,
              boxShadow: `0 0 16px ${dept.hex}66`,
            }}
          />
        </div>
        <h3
          className="font-bold uppercase mb-2"
          style={{ color: "#f0edf1", fontSize: "1.1rem", letterSpacing: "0.02em" }}
        >
          {sen.name}
        </h3>
        <p
          className="font-medium uppercase mb-4"
          style={{
            color: dept.hex,
            fontSize: 11,
            letterSpacing: "0.18em",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {sen.role}
        </p>
        <p
          className="leading-relaxed"
          style={{ color: "#acaaae", fontSize: 13 }}
        >
          {sen.mission}
        </p>
      </div>
    </FadeIn>
  );
}

const COLS_PER_DEPT: Record<string, string> = {
  "dieu-phoi": "sm:grid-cols-2 lg:grid-cols-4",
  "marketing": "sm:grid-cols-2 lg:grid-cols-4",
  "khach-hang": "sm:grid-cols-3",
  "ky-thuat": "sm:grid-cols-2 lg:grid-cols-3",
};

export default function DepartmentGridSection() {
  return (
    <section className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
      <FadeIn delay={0} y={30} className="mb-16">
        <h2
          className="hero-heading font-black uppercase text-center leading-none tracking-tight"
          style={{ fontSize: "clamp(2.5rem, 9vw, 120px)" as string }}
        >
          Đội Ngũ AI Fleet
        </h2>
      </FadeIn>

      <div className="grid grid-cols-1 gap-20 md:gap-24">
        {departments.map((dept) => (
          <section key={dept.key}>
            <FadeIn delay={0} y={20} className="flex items-center gap-6 mb-10">
              <h3
                className="font-bold uppercase tracking-tight"
                style={{
                  color: dept.hex,
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  letterSpacing: "0.05em",
                }}
              >
                {dept.emoji} {dept.label}
              </h3>
              <div
                className="h-[1px] flex-grow"
                style={{
                  background: `linear-gradient(to right, ${dept.hex}55, transparent)`,
                }}
              />
            </FadeIn>
            <div className={`grid grid-cols-1 ${COLS_PER_DEPT[dept.key] ?? "sm:grid-cols-2 lg:grid-cols-3"} gap-6`}>
              {dept.members.map((sen, i) => (
                <SenCard key={sen.id} sen={sen} dept={dept} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
