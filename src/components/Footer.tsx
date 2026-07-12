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
          <a href={contactInfo.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
            className="inline-flex items-center text-secondary hover:text-tertiary transition-colors duration-200">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a href={contactInfo.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
            className="inline-flex items-center text-secondary hover:text-tertiary transition-colors duration-200">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
