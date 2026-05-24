'use client';

import { useI18n } from '@/lib/i18n';

export interface InvoiceInfo {
  required: boolean;
  company_name: string;
  tax_code: string;
  email: string;
}

export const emptyInvoice: InvoiceInfo = {
  required: false, company_name: '', tax_code: '', email: '',
};

interface Props {
  value: InvoiceInfo;
  onChange: (v: InvoiceInfo) => void;
}

export function InvoiceFieldsSection({ value, onChange }: Props) {
  const { t } = useI18n();
  const set = <K extends keyof InvoiceInfo>(k: K, v: InvoiceInfo[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="rounded-xl border border-[#1f2937] bg-[#0a0c0f]/60">
      <label className="flex cursor-pointer items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={value.required}
          onChange={(e) => set('required', e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-[#ff5625]"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#e7eaf0]">{t('portal.components.invoiceFields.toggle_label')}</p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">{t('portal.components.invoiceFields.toggle_hint')}</p>
        </div>
      </label>

      {value.required && (
        <div className="space-y-4 border-t border-[#1f2937] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                {t('portal.components.invoiceFields.company_label')} *
              </label>
              <input
                value={value.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder={t('portal.components.invoiceFields.company_placeholder')}
                className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                {t('portal.components.invoiceFields.tax_label')} *
              </label>
              <input
                value={value.tax_code}
                onChange={(e) => set('tax_code', e.target.value.replace(/[^\d-]/g, '').slice(0, 14))}
                inputMode="numeric"
                pattern="\d{10}(-\d{3})?"
                placeholder={t('portal.components.invoiceFields.tax_placeholder')}
                className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 font-mono text-sm tabular-nums tracking-wider text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
              />
              <p className="mt-1 text-[10px] text-[#9ca3af]">{t('portal.components.invoiceFields.tax_hint')}</p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
              {t('portal.components.invoiceFields.email_label')}
            </label>
            <input
              type="email"
              value={value.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="ketoan@congty.vn"
              className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
            />
            <p className="mt-1 text-[10px] text-[#9ca3af]">{t('portal.components.invoiceFields.email_hint')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Client-side validator — returns error key (i18n) or empty string when ok. */
export function validateInvoice(v: InvoiceInfo): string {
  if (!v.required) return '';
  if (v.company_name.trim().length < 2) return 'portal.components.invoiceFields.err_company';
  if (!/^\d{10}(-\d{3})?$/.test(v.tax_code.trim())) return 'portal.components.invoiceFields.err_tax';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return 'portal.components.invoiceFields.err_email';
  return '';
}
