"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { contactInfo } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

const WelcomePortal = dynamic(() => import("@/components/WelcomePortal"), { ssr: false });

export default function ContactPageClient() {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanPhone = form.phone.replace(/\s/g, "");
    if (!/^[0-9]{10,11}$/.test(cleanPhone)) {
      setError(t('contact.phone_error'));
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t('contactpage.email_invalid'));
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
          message: form.message,
          source: "dailongai.com/lien-he",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("Send failed");
      setSent(true);
    } catch {
      setError(t('contact.submit_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pt-24 sm:pt-28 pb-20 px-5 sm:px-8 lg:px-12 2xl:px-20 max-w-screen-2xl mx-auto">

      {/* Header */}
      <header className="mb-16 sm:mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
          <div>
            <span className="text-primary text-[10px] uppercase tracking-[0.3em] font-headline font-bold mb-4 block">{t('contactpage.connect')}</span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold font-headline tracking-tighter leading-[0.9] text-on-surface">
              {t('contactpage.heading')} <br />{t('contactpage.heading2')}
            </h1>
          </div>
          <div className="max-w-md pb-2">
            <p className="text-secondary text-base sm:text-lg leading-relaxed">
              {t('contactpage.desc')}
            </p>
          </div>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Info Cards */}
        <div className="lg:col-span-4 space-y-6">
          {/* Hotline */}
          <a href={`tel:${contactInfo.hotline.replace(/\s/g, "")}`} className="block bg-surface-high/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 hover:bg-surface-highest transition-all duration-500 group">
            <svg className="w-10 h-10 text-primary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <h3 className="text-xl font-bold font-headline mb-2">Hotline</h3>
            <p className="text-secondary text-sm mb-4">{t('contactpage.hotline_desc')}</p>
            <span className="text-primary font-bold text-lg font-headline group-hover:translate-x-2 transition-transform inline-block">{contactInfo.hotline}</span>
          </a>

          {/* Zalo */}
          <a href={contactInfo.zalo} target="_blank" rel="noopener noreferrer" className="block bg-surface-high/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 hover:bg-surface-highest transition-all duration-500 group">
            <svg className="w-10 h-10 text-[#4da6ff] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-xl font-bold font-headline mb-2">Zalo</h3>
            <p className="text-secondary text-sm mb-4">{t('contactpage.zalo_desc')}</p>
            <span className="text-[#4da6ff] font-bold text-sm font-headline flex items-center gap-2 group-hover:translate-x-2 transition-transform">
              {t('contactpage.zalo_cta')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </span>
          </a>

          {/* Email */}
          <a href={`mailto:${contactInfo.email}`} className="block bg-surface-high/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 hover:bg-surface-highest transition-all duration-500 group">
            <svg className="w-10 h-10 text-primary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-bold font-headline mb-2">E-Mail</h3>
            <p className="text-secondary text-sm mb-4">{t('contactpage.email_desc')}</p>
            <span className="text-primary font-bold text-sm font-headline group-hover:translate-x-2 transition-transform inline-block">{contactInfo.email}</span>
          </a>
        </div>

        {/* Right: Contact Form */}
        <div className="lg:col-span-8">
          <div className="bg-surface-high/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 sm:p-10 h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full blur-[60px]" />
            <h2 className="text-2xl sm:text-3xl font-bold font-headline mb-8 sm:mb-10 tracking-tight relative z-10">{t('contactpage.form_heading')}</h2>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-20 text-center relative z-10">
                <svg className="w-16 h-16 text-primary mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-2xl font-bold font-headline mb-2">{t('contactpage.thank_you')}</h3>
                <p className="text-secondary">{t('contactpage.will_contact')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-headline font-bold ml-2">{t('contact.name')}</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-surface-container border-none rounded-xl p-4 outline-none transition-all placeholder:text-secondary/30 font-body focus:ring-1 focus:ring-primary/50 focus:bg-surface-high text-on-surface"
                      placeholder={t('contact.placeholder_name')} type="text" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-headline font-bold ml-2">{t('contact.phone')}</label>
                    <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full bg-surface-container border-none rounded-xl p-4 outline-none transition-all placeholder:text-secondary/30 font-body focus:ring-1 focus:ring-primary/50 focus:bg-surface-high text-on-surface"
                      placeholder={t('contact.placeholder_phone')} type="tel" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-headline font-bold ml-2">E-Mail</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl p-4 outline-none transition-all placeholder:text-secondary/30 font-body focus:ring-1 focus:ring-primary/50 focus:bg-surface-high text-on-surface"
                    placeholder={t('contact.placeholder_email')} type="email" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-secondary font-headline font-bold ml-2">{t('contactpage.content_label')}</label>
                  <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl p-4 outline-none transition-all placeholder:text-secondary/30 font-body focus:ring-1 focus:ring-primary/50 focus:bg-surface-high resize-none text-on-surface"
                    placeholder={t('contactpage.placeholder_message')} rows={5} />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="pt-4">
                  <button type="submit" disabled={loading}
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold px-10 sm:px-12 py-4 sm:py-5 rounded-full hover:shadow-[0_0_30px_rgba(255,144,105,0.3)] transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {loading ? t('contact.submitting') : t('contactpage.send_request')}
                    {!loading && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom: Showrooms */}
        <div className="lg:col-span-12 mt-6">
          <div className="bg-surface-high/60 backdrop-blur-md border border-white/5 rounded-[2rem] overflow-hidden flex flex-col md:flex-row min-h-[350px]">
            <div className="w-full md:w-1/2 p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <span className="text-primary text-[10px] uppercase tracking-[0.3em] font-headline font-bold mb-4 block">{t('contactpage.showroom_label')}</span>
                <h3 className="text-2xl sm:text-3xl font-bold font-headline mb-6">{t('contactpage.showroom_cities')}</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <svg className="w-6 h-6 text-primary mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-on-surface font-bold text-sm mb-1">{t('contactpage.hanoi')}</p>
                      <p className="text-secondary text-sm leading-relaxed">{contactInfo.showroom}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <svg className="w-6 h-6 text-primary mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-on-surface font-bold text-sm mb-1">{t('contactpage.hcmc')}</p>
                      <p className="text-secondary text-sm leading-relaxed">{contactInfo.showroomHCM}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <div className="p-4 bg-surface-container rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-secondary uppercase tracking-widest font-headline">{t('contactpage.work_hours')}</p>
                    <p className="font-headline font-bold">{contactInfo.showroomHours}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Globe Network 3D Animation */}
            <div className="w-full md:w-1/2 relative min-h-[400px] overflow-hidden" style={{ background: "#0c0e10" }}>
              <WelcomePortal welcomeTitle={t('contactpage.welcome_title')} welcomeDesc={t('contactpage.welcome_desc')} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
