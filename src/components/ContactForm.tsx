"use client";

import { useState, useEffect, useRef } from "react";
import { contactInfo } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

export default function ContactForm() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", interest: "", message: "" });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        try {
          gsap.fromTo(".contact-head > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".contact-head", start: "top 80%" } });
          gsap.fromTo(".contact-body", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: ".contact-body", start: "top 85%" } });
        } catch { /* animation not critical */ }
      }, sectionRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const cleanPhone = form.phone.replace(/\s/g, "");
    if (!/^[0-9]{10,11}$/.test(cleanPhone)) {
      setError(t('contact.phone_error'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("https://zalo.longanhai.com/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email || "",
          interest: form.interest || "",
          message: form.message || "",
          source: "dailongai.com",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("Send failed");
      setSubmitted(true);
      setForm({ name: "", phone: "", email: "", interest: "", message: "" });
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setError(t('contact.submit_error'));
    } finally {
      setLoading(false);
    }
  };

  const interestOptions = [
    t('contact.interest1'),
    t('contact.interest2'),
    t('contact.interest3'),
    t('contact.interest4'),
    t('contact.interest5'),
  ];

  const inputClass = "w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-surface-container border border-white/8 text-on-surface placeholder-secondary/40 text-xs sm:text-sm transition-all duration-300 hover:border-white/15 focus:border-primary focus:outline-none focus:shadow-[0_0_0_2px_rgba(255,86,37,0.15)] rounded-sm";

  return (
    <section ref={sectionRef} id="contact" className="pt-24 sm:pt-32 pb-24 sm:pb-32 px-5 sm:px-8 lg:px-12 2xl:px-20 bg-surface-low laser-grid border-t border-white/5">
      <div className="max-w-screen-2xl mx-auto">
        <div className="contact-head text-center max-w-4xl mx-auto mb-14 sm:mb-16">
          <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase mb-3 opacity-0">{t('contact.subtitle')}</h2>
          <h3 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline tracking-tighter uppercase opacity-0">{t('contact.heading')}<span className="text-primary italic"> — 0935 999 922</span></h3>
        </div>

        <div className="contact-body grid lg:grid-cols-2 gap-8 sm:gap-10 opacity-0">
          <div className="space-y-4 sm:space-y-6">
            <p className="text-secondary text-xs sm:text-sm leading-relaxed">
              {t('contact.desc')}
            </p>
            {[
              { label: t('contact.showroom_hn'), value: contactInfo.showroom, sub: contactInfo.showroomHours },
              { label: t('contact.showroom_hcm'), value: contactInfo.showroomHCM, sub: contactInfo.showroomHours },
              { label: "Hotline", value: contactInfo.hotline },
              { label: "E-Mail", value: contactInfo.email },
              { label: "Zalo Shop", value: "Nhắn tin tư vấn qua Zalo" },
            ].map((item) => (
              <div key={item.label} className="border-l-2 border-primary/20 pl-3 sm:pl-4">
                <p className="text-[9px] sm:text-[10px] text-secondary uppercase tracking-widest font-headline font-bold">{item.label}</p>
                <p className="text-on-surface text-xs sm:text-sm font-medium">{item.value}</p>
                {item.sub && <p className="text-secondary/60 text-[10px]">{item.sub}</p>}
              </div>
            ))}
          </div>

          <div className="">
            <form onSubmit={handleSubmit} className="glass-panel p-5 sm:p-6 md:p-8 rounded-xl space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] text-secondary uppercase tracking-widest font-headline font-bold mb-1 sm:mb-1.5">{t('contact.name')} *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('contact.placeholder_name')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] text-secondary uppercase tracking-widest font-headline font-bold mb-1 sm:mb-1.5">{t('contact.phone')} *</label>
                  <input type="tel" required value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder={t('contact.placeholder_phone')} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-secondary uppercase tracking-widest font-headline font-bold mb-1 sm:mb-1.5">{t('contact.email')}</label>
                <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder={t('contact.placeholder_email')} className={inputClass} />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-secondary uppercase tracking-widest font-headline font-bold mb-1 sm:mb-1.5">{t('contact.interest')}</label>
                <select value={form.interest} onChange={(e) => setForm((prev) => ({ ...prev, interest: e.target.value }))} className={`${inputClass} appearance-none`}>
                  <option value="" className="bg-surface">{t('contact.select_interest')}</option>
                  {interestOptions.map((o) => <option key={o} value={o} className="bg-surface">{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-secondary uppercase tracking-widest font-headline font-bold mb-1 sm:mb-1.5">{t('contact.message')}</label>
                <textarea rows={3} value={form.message} onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))} placeholder={t('contact.placeholder_message')} className={`${inputClass} resize-none`} />
              </div>
              {error && <p className="text-center text-red-400 text-xs sm:text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-3.5 sm:py-4 bg-primary-container text-on-primary font-headline font-black tracking-widest text-[10px] sm:text-xs uppercase glow-primary-hover hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-50">
                {loading ? t('contact.submitting') : submitted ? t('contact.submitted') : t('contact.submit')}
              </button>
              {submitted && <p className="text-center text-tertiary text-xs sm:text-sm animate-pulse">{t('contact.thanks')}</p>}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
