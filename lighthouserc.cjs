module.exports = {
  ci: {
    collect: {
      staticDistDir: "./out",
      // Next 16 xuất tĩnh ra file phẳng (out/san-pham.html); thư mục cùng tên chỉ
      // chứa payload .txt nên đường dẫn kiểu /san-pham/index.html trả về 404.
      url: [
        "http://localhost/index.html",
        "http://localhost/san-pham.html",
        "http://localhost/blog.html",
        "http://localhost/about-us.html",
        "http://localhost/lien-he.html",
      ],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        skipAudits: ["uses-http2"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
