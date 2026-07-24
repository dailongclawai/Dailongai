"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navLinks = [
    { label: t('nav.home'), href: '/' },
    { label: t('nav.about'), href: '/about-us' },
    { label: t('nav.products'), href: '/san-pham' },
    { label: t('nav.health'), href: '/thuc-trang-suc-khoe' },
    { label: t('nav.blog'), href: '/blog' },
    { label: t('nav.contact'), href: '/lien-he' },
  ];

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll while drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [drawerOpen]);

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

  const loginCta = (
    <Link href="/portal/login" className="dl-portal-cta dl-portal-cta--ghost" aria-label="Đăng nhập">
      <span className="dl-portal-cta__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      </span>
      <span className="dl-portal-cta__text">Đăng nhập</span>
    </Link>
  );

  const registerCta = (
    <Link href="/portal/register" className="dl-portal-cta dl-portal-cta--primary" aria-label="Đăng ký">
      <span className="dl-portal-cta__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      </span>
      <span className="dl-portal-cta__text">Đăng ký</span>
    </Link>
  );

  return (
    <>
      <nav className="dl-header">
        <div className="dl-header__row">
          <Link href="/" className="dl-header__logo" aria-label="Đại Long trang chủ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-orange.webp" alt="Đại Long" width={120} height={120} fetchPriority="high" loading="eager" decoding="async" />
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <div className="dl-navbar dl-navbar--desktop">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className={`dl-nav-link${isActive(l.href) ? ' active' : ''}`}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right cluster: CTAs + lang + hamburger */}
          <div className="dl-header__right">
            <div className="dl-header__cta-group">
              {loginCta}
              {registerCta}
            </div>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="dl-burger"
              aria-label="Mở menu điều hướng"
              aria-expanded={drawerOpen}
            >
              <span aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="3" y1="7" x2="21" y2="7" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="dl-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`dl-drawer${drawerOpen ? ' open' : ''}`}
        aria-hidden={!drawerOpen}
      >
        <div className="dl-drawer__header">
          <span className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625] font-bold">Menu</span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="dl-drawer__close"
            aria-label="Đóng menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="dl-drawer__nav">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`dl-drawer-link${isActive(l.href) ? ' active' : ''}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
