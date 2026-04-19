import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { navLinks } from "@/data/siteData";

export const metadata = {
  title: "Không tìm thấy trang | Đại Long",
  description: "Trang bạn đang tìm kiếm không tồn tại.",
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[80vh] flex items-center justify-center px-4 pt-32 pb-16">
        <div className="text-center max-w-lg mx-auto">
          <p className="text-8xl font-bold font-headline text-primary mb-4">404</p>
          <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface mb-3">
            Trang không tồn tại
          </h1>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            Trang bạn đang tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời không khả dụng.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary font-headline font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Về trang chủ
            </a>
            <a
              href="/lien-he"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-outline-variant text-on-surface font-headline font-bold text-sm uppercase tracking-wider hover:bg-surface-container transition-colors"
            >
              Liên hệ hỗ trợ
            </a>
          </div>

          <div className="border-t border-outline-variant pt-8">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-4 font-headline">
              Trang phổ biến
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
