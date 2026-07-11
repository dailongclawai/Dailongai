import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import BackgroundMusic from "@/components/BackgroundMusic";
import Observability from "@/components/Observability";
import { I18nProvider } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const interHeadline = Inter({
  variable: "--font-headline",
  subsets: ["latin", "vietnamese"],
  weight: ["700", "800"],
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
    "công nghệ y tế, thiết bị laser, Đại Long, laser trị liệu, Lipid Shield, công nghệ chăm sóc sức khỏe",
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
    <html lang="vi" className={cn("dark", "antialiased", interHeadline.variable, inter.variable, "font-body")}>
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
                  name: "Đại Long — Công nghệ chăm sóc sức khoẻ",
                  legalName: "Công ty TNHH Công nghệ và Y tế Đại Long",
                  url: siteUrl,
                  logo: `${siteUrl}/images/logo.webp`,
                  slogan: "Giải pháp Laser Trị liệu & Công nghệ Y tế Hiện đại",
                  identifier: {
                    "@type": "PropertyValue",
                    propertyID: "Giấy phép Trang thiết bị y tế (Sở Y tế Hà Nội)",
                    value: "260001468/PCBB-HN",
                  },
                  contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+84-935-999-922",
                    contactType: "sales",
                    availableLanguage: "Vietnamese",
                    email: "dongoclong@dailongai.com",
                  },
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "165,171 Yên Lãng",
                    addressLocality: "Hà Nội",
                    addressRegion: "Đống Đa",
                    addressCountry: "VN",
                  },
                  sameAs: [
                    "https://www.tiktok.com/@dailongai",
                    "https://zalo.me/2860930231550407599",
                  ],
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
                  name: "Lipid Shield — Máy Laser Bán dẫn Công suất thấp",
                  description:
                    "Thiết bị laser trị liệu bước sóng 650nm, hỗ trợ tuần hoàn máu, cải thiện giấc ngủ. Bảo hành 5 năm chính hãng.",
                  image: `${siteUrl}/images/sp-1.webp`,
                  brand: { "@type": "Brand", name: "Lipid Shield" },
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
                  "@type": "MedicalBusiness",
                  "@id": `${siteUrl}/#medicalbusiness`,
                  name: "Đại Long — Showroom & Trung tâm tư vấn Hà Nội",
                  parentOrganization: { "@id": `${siteUrl}/#organization` },
                  image: `${siteUrl}/images/logo.webp`,
                  url: siteUrl,
                  telephone: "+84-935-999-922",
                  email: "dongoclong@dailongai.com",
                  priceRange: "20.000.000₫ - 35.000.000₫",
                  medicalSpecialty: ["PhysicalTherapy", "Cardiovascular", "Geriatric"],
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
                  identifier: {
                    "@type": "PropertyValue",
                    propertyID: "Giấy phép Trang thiết bị y tế (Sở Y tế Hà Nội)",
                    value: "260001468/PCBB-HN",
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
        <script dangerouslySetInnerHTML={{ __html: `(function(c,e){var a=c.tracksma=c.tracksma||[];if(!a.initialize&&!a.invoked){a.invoked=!0;a.methods="trackSubmit trackClick trackLink trackForm page identify reset track".split(" ");a.factory=function(b){return function(){var d=Array.prototype.slice.call(arguments);d.unshift(b);a.push(d);return a}};for(c=0;c<a.methods.length;c++){var f=a.methods[c];a[f]=a.factory(f)}a.load=function(b,d){a.SNIPPET_APP=b;b=e.createElement("script");b.type="text/javascript";b.async=!0;b.src="https://s.eclick.vn/smaevents.js";d=e.getElementsByTagName("script")[0];d.parentNode.insertBefore(b,d)};a.load(1000021131)}})(window,document)` }} />
      </body>
    </html>
  );
}
