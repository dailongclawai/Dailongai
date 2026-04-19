"use client";

import { useEffect, useRef, useState } from "react";

interface PagefindResult {
  id: string;
  data: () => Promise<{
    url: string;
    excerpt: string;
    meta: { title?: string };
  }>;
}

interface PagefindAPI {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
}

declare global {
  interface Window {
    pagefind?: PagefindAPI;
  }
}

type Hit = { url: string; title: string; excerpt: string };

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (window.pagefind) return;
    (async () => {
      try {
        const mod = await import(/* webpackIgnore: true */ "/_pagefind/pagefind.js" as string);
        window.pagefind = mod as PagefindAPI;
      } catch {
        /* index not built yet */
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!query.trim() || !window.pagefind) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.pagefind
      .search(query)
      .then(async (res) => {
        const data = await Promise.all(res.results.slice(0, 10).map((r) => r.data()));
        if (cancelled) return;
        setHits(data.map((d) => ({ url: d.url, title: d.meta.title || d.url, excerpt: d.excerpt })));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm"
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-low rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bài viết, sản phẩm…"
            className="w-full bg-transparent text-on-surface text-lg outline-none placeholder:text-secondary/60"
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="p-6 text-sm text-secondary">Đang tìm…</div>}
          {!loading && query && hits.length === 0 && (
            <div className="p-6 text-sm text-secondary">Không có kết quả.</div>
          )}
          {hits.map((h) => (
            <a
              key={h.url}
              href={h.url}
              className="block p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
              onClick={onClose}
            >
              <div className="font-headline font-bold text-on-surface mb-1">{h.title}</div>
              <div className="text-sm text-secondary" dangerouslySetInnerHTML={{ __html: h.excerpt }} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
