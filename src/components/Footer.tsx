"use client";

import { contactInfo } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const { t } = useI18n();

  const navLinks = [
    { label: t('nav.home'), href: "/" },
    { label: t('nav.about'), href: "/about-us" },
    { label: t('nav.products'), href: "/san-pham" },
    { label: t('nav.health'), href: "/thuc-trang-suc-khoe" },
    { label: t('nav.blog'), href: "/blog" },
    { label: t('nav.contact'), href: "/lien-he" },
  ];

  return (
    <footer className="bg-background w-full py-12 sm:py-16 px-5 sm:px-8 lg:px-12 2xl:px-20 border-t border-primary-container/10">
      <div className="max-w-screen-2xl mx-auto space-y-6 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-8 sm:items-center text-center sm:text-left">
        <div className="space-y-2">
          <div className="text-base sm:text-lg font-bold text-secondary font-headline uppercase tracking-tighter">ĐẠI LONG</div>
          <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-normal text-secondary max-w-sm space-y-1">
            <p>{contactInfo.company}</p>
            <p>{contactInfo.address}</p>
            <p>Hotline: {contactInfo.hotline}</p>
          </div>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-normal text-secondary/70">
            © {new Date().getFullYear()} Đại Long. {t('footer.rights')}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 sm:gap-x-8 gap-y-2 sm:justify-end">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}
              className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-normal text-secondary hover:text-tertiary transition-colors duration-200">
              {link.label}
            </a>
          ))}
          <a href={contactInfo.zalo} target="_blank" rel="noopener noreferrer"
            className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-normal text-secondary hover:text-tertiary transition-colors duration-200">
            {t('footer.zalo_shop')}
          </a>
        </div>
      </div>
    </footer>
  );
}
