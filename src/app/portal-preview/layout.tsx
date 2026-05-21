// PROTOTYPE — editorial portal layout. Wipe with folder when design is folded in.

import type { ReactNode } from 'react';
import { Fraunces, Manrope, JetBrains_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-display',
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-numeric',
  display: 'swap',
});

export default function PortalPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${manrope.variable} ${jetbrains.variable} min-h-screen bg-[#f5f1e8] font-sans antialiased text-[#0e1525]`}
      style={{
        fontFamily: 'var(--font-body), system-ui, sans-serif',
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(14,21,37,0.04) 1px, transparent 0)",
        backgroundSize: '24px 24px',
      }}
    >
      {children}
    </div>
  );
}
