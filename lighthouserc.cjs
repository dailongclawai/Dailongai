module.exports = {
  ci: {
    collect: {
      staticDistDir: "./out",
      url: [
        "http://localhost/index.html",
        "http://localhost/san-pham/index.html",
        "http://localhost/blog/index.html",
        "http://localhost/about-us/index.html",
        "http://localhost/lien-he/index.html",
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
