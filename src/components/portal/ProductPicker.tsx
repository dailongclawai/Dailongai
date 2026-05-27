'use client';

interface PickableModel {
  id: string;
  code: string;
  name: string;
  base_price: number | string;
  image_url?: string | null;
}

interface Props {
  models: PickableModel[];
  selectedId: string;
  onSelect: (id: string) => void;
  surface?: 'portal' | 'public';
}

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export function ProductPicker({ models, selectedId, onSelect, surface = 'portal' }: Props) {
  const bg = surface === 'public' ? 'bg-[#121416]' : 'bg-[#0a0c0f]';
  const borderIdle = surface === 'public' ? 'border-[#3d3f41]/40' : 'border-[#1f2937]/60';

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {models.map((m) => {
        const selected = m.id === selectedId;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            aria-pressed={selected}
            className={`group relative flex items-center gap-3 rounded-xl border-2 ${bg} p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#ff5625]/50 ${
              selected ? 'border-[#ff5625] shadow-[0_0_24px_-6px_rgba(255,86,37,0.55)]' : `${borderIdle} hover:border-[#ff5625]/40`
            }`}
          >
            <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${selected ? 'border-[#ff5625]/40' : 'border-[#1f2937]'} bg-white`}>
              {m.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.image_url} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#1a1f26] text-[10px] text-[#6b7280]">No image</div>
              )}
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center bg-[#ff5625]/15">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff5625] text-white shadow">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                  </span>
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-bold ${selected ? 'text-[#ff5625]' : 'text-[#e7eaf0]'}`}>{m.name}</p>
              <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-[#9ca3af]">{m.code}</p>
              <p className="mt-1 font-mono tabular-nums text-sm font-semibold text-[#e7eaf0]">{fmtVnd(Number(m.base_price))} ₫</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
