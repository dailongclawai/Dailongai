'use client';
// PROTOTYPE — Floating switcher bar. Wipe with rest of /portal-preview/.

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: Array<{ key: string; name: string }>;
  current: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const cycle = (dir: -1 | 1) => {
    const i = variants.findIndex((v) => v.key === current);
    const next = variants[(i + dir + variants.length) % variants.length];
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.set('variant', next.key);
    router.replace(`?${params.toString()}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const currentVariant = variants.find((v) => v.key === current) ?? variants[0];

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2 py-1.5 shadow-2xl ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => cycle(-1)}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
          aria-label="Variant trước"
        >
          ◀
        </button>
        <div className="min-w-[230px] px-3 text-center text-sm font-medium text-slate-900">
          <span className="inline-block rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white mr-2">{currentVariant.key}</span>
          {currentVariant.name}
        </div>
        <button
          type="button"
          onClick={() => cycle(1)}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
          aria-label="Variant kế"
        >
          ▶
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-500">← → để chuyển nhanh · PROTOTYPE — sẽ xóa sau khi Boss chốt</p>
    </div>
  );
}
