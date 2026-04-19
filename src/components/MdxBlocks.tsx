"use client";

import { useState, type ReactNode } from "react";

export function Callout({ tone = "info", children }: { tone?: "info" | "warning" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-primary/40 bg-primary/5 text-on-surface",
    warning: "border-amber-500/40 bg-amber-500/5 text-amber-100",
    success: "border-emerald-500/40 bg-emerald-500/5 text-emerald-100",
  }[tone];
  return <div className={`my-6 rounded-xl border-l-4 ${styles} p-4`}>{children}</div>;
}

export function KeyStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="my-6 inline-flex flex-col items-start rounded-2xl bg-surface-low border border-white/10 px-6 py-4">
      <span className="text-3xl font-headline font-black text-primary">{value}</span>
      <span className="text-sm text-secondary mt-1">{label}</span>
    </div>
  );
}

export function BmiCalculator() {
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const heightM = parseFloat(h) / 100;
  const weightKg = parseFloat(w);
  const bmi = heightM > 0 && weightKg > 0 ? weightKg / (heightM * heightM) : null;
  const tone =
    bmi == null ? "" :
    bmi < 18.5 ? "Thiếu cân" :
    bmi < 25 ? "Bình thường" :
    bmi < 30 ? "Thừa cân" : "Béo phì";

  return (
    <div className="my-8 p-6 rounded-2xl bg-surface-low border border-primary/20">
      <div className="font-headline font-bold mb-3 text-on-surface">Máy tính BMI</div>
      <div className="flex flex-wrap gap-3">
        <input
          type="number"
          value={h}
          onChange={(e) => setH(e.target.value)}
          placeholder="Chiều cao (cm)"
          className="bg-background border border-white/10 rounded-lg px-3 py-2 text-on-surface w-40"
        />
        <input
          type="number"
          value={w}
          onChange={(e) => setW(e.target.value)}
          placeholder="Cân nặng (kg)"
          className="bg-background border border-white/10 rounded-lg px-3 py-2 text-on-surface w-40"
        />
      </div>
      {bmi != null && (
        <div className="mt-4 text-on-surface">
          BMI: <span className="font-bold text-primary">{bmi.toFixed(1)}</span> — {tone}
        </div>
      )}
    </div>
  );
}
