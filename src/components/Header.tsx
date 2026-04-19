"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const pathname = usePathname();
  const { t } = useI18n();

  const navLinks = [
    { label: t('nav.home'), href: '/' },
    { label: t('nav.about'), href: '/about-us' },
    { label: t('nav.products'), href: '/san-pham' },
    { label: t('nav.health'), href: '/thuc-trang-suc-khoe' },
    { label: t('nav.blog'), href: '/blog' },
    { label: t('nav.contact'), href: '/lien-he' },
  ];

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(18,20,22,0.97)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{
          maxWidth: "1536px", margin: "0 auto", padding: "12px clamp(16px, 3vw, 80px)",
        }}>
          {/* Single row: Logo + Nav + Controls */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <img src="/images/logo-orange.webp" alt="Đại Long" className="h-[58px] w-auto -my-3" width={120} height={120} fetchPriority="high" loading="eager" decoding="async" />
            </Link>

            {/* Nav links — Pill + Glow Active */}
            <div className="dl-navbar">
              {navLinks.map((l) => {
                const isActive = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
                return (
                  <Link key={l.href} href={l.href} className={`dl-nav-link${isActive ? ' active' : ''}`}>
                    {l.label}
                  </Link>
                );
              })}
            </div>

            {/* Language switcher */}
            <div style={{ flexShrink: 0 }}>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

      </nav>
    </>
  );
}
