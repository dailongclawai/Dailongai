import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import BackgroundMusic from "@/components/BackgroundMusic";
import Observability from "@/components/Observability";
import { I18nProvider } from "@/lib/i18n";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-headline",
  subsets: ["latin", "vietnamese"],
  weight: ["700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

const siteUrl = "https://dailongai.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Đại Long | Công nghệ & Y tế — Giải pháp Laser Trị liệu Hiện đại",
  description:
    "Đại Long — Đơn vị tiên phong cung cấp thiết bị laser trị liệu và giải pháp công nghệ y tế hiện đại. Ứng dụng công nghệ tiên tiến vào chăm sóc sức khỏe.",
  keywords:
    "công nghệ y tế, thiết bị laser, Đại Long, laser trị liệu, Zhidun, công nghệ chăm sóc sức khỏe",
  alternates: {
    canonical: siteUrl,
    languages: {
      "vi-VN": siteUrl,
      "en": siteUrl,
      "zh": siteUrl,
      "ja": siteUrl,
      "ko": siteUrl,
      "ru": siteUrl,
      "x-default": siteUrl,
    },
  },
  openGraph: {
    title: "Đại Long | Công nghệ & Y tế",
    description: "Giải pháp Laser Trị liệu & Công nghệ Y tế Hiện đại",
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Đại Long",
    images: [
      {
        url: "/images/home-banner-840.webp",
        width: 1200,
        height: 630,
        alt: "Đại Long — Giải pháp Laser Trị liệu Hiện đại",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Đại Long | Công nghệ & Y tế",
    description: "Giải pháp Laser Trị liệu & Công nghệ Y tế Hiện đại",
    images: ["/images/home-banner-840.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${spaceGrotesk.variable} ${inter.variable} dark antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preload" href="/images/logo-orange.webp" as="image" type="image/webp" fetchPriority="high" />
        <link rel="preload" href="/images/home-banner-840.webp" as="image" type="image/webp" imageSrcSet="/images/home-banner-560.webp 560w, /images/home-banner-840.webp 840w" imageSizes="(max-width: 672px) 100vw, 672px" fetchPriority="high" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}/#organization`,
                  name: "Công ty TNHH Công nghệ và Y tế Đại Long",
                  url: siteUrl,
                  logo: `${siteUrl}/images/logo.webp`,
                  contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+84-935-999-922",
                    contactType: "sales",
                    availableLanguage: "Vietnamese",
                  },
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "165,171 Yên Lãng",
                    addressLocality: "Hà Nội",
                    addressRegion: "Đống Đa",
                    addressCountry: "VN",
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl}/#website`,
                  url: siteUrl,
                  name: "Đại Long",
                  publisher: { "@id": `${siteUrl}/#organization` },
                  inLanguage: "vi",
                },
                {
                  "@type": "Product",
                  name: "ZhiDun CEO — Máy Laser Bán dẫn Công suất thấp",
                  description:
                    "Thiết bị laser trị liệu bước sóng 650nm, hỗ trợ tuần hoàn máu, cải thiện giấc ngủ. Bảo hành 5 năm chính hãng.",
                  image: `${siteUrl}/images/sp-1.webp`,
                  brand: { "@type": "Brand", name: "ZhiDun" },
                  offers: {
                    "@type": "Offer",
                    price: "29500000",
                    priceCurrency: "VND",
                    availability: "https://schema.org/InStock",
                    url: `${siteUrl}/san-pham`,
                    seller: { "@id": `${siteUrl}/#organization` },
                  },
                },
                {
                  "@type": "LocalBusiness",
                  name: "Đại Long — Showroom Hà Nội",
                  image: `${siteUrl}/images/logo.webp`,
                  telephone: "+84-935-999-922",
                  email: "admin@dailong.ai",
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "165,171 Yên Lãng",
                    addressLocality: "Hà Nội",
                    addressRegion: "Đống Đa",
                    addressCountry: "VN",
                  },
                  openingHoursSpecification: {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                    opens: "09:00",
                    closes: "18:00",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-on-surface font-body selection:bg-primary-container/30">
        <I18nProvider>
          {children}
          <BackgroundMusic />
          <ChatWidget />
        </I18nProvider>
        <Observability />
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18055317984" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-X9YDDLXX3H');gtag('config','AW-18055317984');` }} />
      </body>
    </html>
  );
}
