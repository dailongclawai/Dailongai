'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export interface BankInfo {
  code: string;
  bin: string;
  name: string;
  shortName: string;
}

interface Props {
  value: string;
  onChange: (bank: BankInfo) => void;
  required?: boolean;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

const LOGO = (code: string) => `https://cdn.vietqr.io/img/${code}.png`;

export function BankPicker({ value, onChange, required }: Props) {
  const { t } = useI18n();
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/data/vn-banks.json')
      .then((r) => r.json())
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const selected = useMemo(() => banks.find((b) => b.shortName === value || b.name === value), [banks, value]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return banks;
    return banks.filter((b) => {
      const hay = `${normalize(b.shortName)} ${normalize(b.name)} ${b.code.toLowerCase()} ${b.bin}`;
      return hay.includes(q);
    });
  }, [banks, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-lg border bg-[#0a0c0f] px-3 py-2.5 text-left text-sm transition-colors ${
          open ? 'border-[#ff5625]' : 'border-[#1f2937] hover:border-[#1f2937]'
        }`}
      >
        {selected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO(selected.code)}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-md bg-white object-contain p-0.5"
              loading="lazy"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-[#e7eaf0]">{selected.shortName}</span>
              <span className="block truncate text-[10px] text-[#9ca3af]">{selected.name}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1a1f26] text-[#9ca3af]">
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
            </span>
            <span className="flex-1 text-[#9ca3af]">{t('portal.components.bankPicker.placeholder_select')}</span>
          </>
        )}
        <span className="material-symbols-outlined text-[18px] text-[#9ca3af]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {required && !selected && (
        <input
          type="text"
          required
          value=""
          onChange={() => undefined}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-0 w-full opacity-0"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[#1f2937] bg-[#11151a] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 border-b border-[#1f2937] bg-[#0a0c0f] px-3 py-2">
            <span className="material-symbols-outlined text-[18px] text-[#9ca3af]">search</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('portal.components.bankPicker.search_placeholder')}
              className="flex-1 bg-transparent text-sm text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-[#9ca3af] hover:text-[#e7eaf0]" aria-label={t('portal.components.bankPicker.aria_clear_search')}>
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
          <ul className="max-h-[320px] overflow-y-auto portal-scroll" role="listbox">
            {banks.length === 0 ? (
              <li className="p-4 text-center text-xs text-[#9ca3af]">{t('portal.components.bankPicker.loading')}</li>
            ) : filtered.length === 0 ? (
              <li className="p-4 text-center text-xs text-[#9ca3af]">{t('portal.components.bankPicker.no_results')}</li>
            ) : (
              filtered.map((b) => {
                const isSelected = selected?.code === b.code;
                return (
                  <li key={b.code} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => { onChange(b); setOpen(false); setQuery(''); }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected ? 'bg-[#ff5625]/10' : 'hover:bg-[#1a1f26]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={LOGO(b.code)}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#e7eaf0]">{b.shortName}</p>
                        <p className="truncate text-[11px] text-[#9ca3af]">{b.name}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#9ca3af]">{b.bin}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[18px] text-[#ff5625]">check</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-[#1f2937] bg-[#0a0c0f] px-3 py-2 text-[10px] text-[#9ca3af]">
            {filtered.length} / {banks.length} {t('portal.components.bankPicker.footer_count_suffix')}
          </div>
        </div>
      )}
    </div>
  );
}
