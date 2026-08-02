'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export interface AddressValue {
  province_code: string;
  province_name: string;
  ward_code: string;
  ward_name: string;
  ward_district: string;
  detail: string;
}

interface Province { code: string; name: string }
interface Ward { code: string; name: string; district: string }

export function fullAddress(v: AddressValue): string {
  const parts = [v.detail.trim(), v.ward_name, v.ward_district, v.province_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

export const emptyAddress: AddressValue = {
  province_code: '', province_name: '',
  ward_code: '', ward_name: '', ward_district: '',
  detail: '',
};

export function AddressPicker({
  value,
  onChange,
  required = true,
  inputClass = 'w-full rounded-lg border border-[#3f4944]/40 bg-[#0c0e11] px-3 py-2.5 text-sm outline-none focus:border-[#8bd6b6]',
  labelClass = 'block text-[11px] uppercase tracking-wider text-[#a8b3ac] mb-1.5',
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  required?: boolean;
  inputClass?: string;
  labelClass?: string;
}) {
  const { t } = useI18n();
  const [provinces, setProvinces] = useState<Province[]>([]);
  // Gắn danh sách phường với đúng mã tỉnh đã tải xong, nhờ vậy suy ra được danh
  // sách hiện hành và cờ đang tải ngay lúc render, không phải setState trong effect.
  const [loadedWards, setLoadedWards] = useState<{ code: string; list: Ward[] } | null>(null);
  const provinceCode = value.province_code ?? '';

  useEffect(() => {
    fetch('/data/vn-provinces.json')
      .then((r) => r.json())
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!provinceCode) return;
    let cancelled = false;
    fetch(`/data/vn-wards/${provinceCode}.json`)
      .then((r) => r.json())
      .then((list: Ward[]) => { if (!cancelled) setLoadedWards({ code: provinceCode, list }); })
      .catch(() => { if (!cancelled) setLoadedWards({ code: provinceCode, list: [] }); });
    return () => { cancelled = true; };
  }, [provinceCode]);

  const wards = loadedWards?.code === provinceCode ? loadedWards.list : [];
  const loadingWards = Boolean(provinceCode) && loadedWards?.code !== provinceCode;

  const onProvince = (code: string) => {
    const p = provinces.find((x) => x.code === code);
    onChange({
      ...value,
      province_code: code,
      province_name: p?.name ?? '',
      ward_code: '',
      ward_name: '',
      ward_district: '',
    });
  };

  const onWard = (code: string) => {
    const w = wards.find((x) => x.code === code);
    onChange({
      ...value,
      ward_code: code,
      ward_name: w?.name ?? '',
      ward_district: w?.district ?? '',
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>{t('portal.components.addressPicker.province_label')}</label>
        <select
          value={value.province_code}
          onChange={(e) => onProvince(e.target.value)}
          required={required}
          className={inputClass}
        >
          <option value="">{t('portal.components.addressPicker.province_placeholder')}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t('portal.components.addressPicker.ward_label')}</label>
        <select
          value={value.ward_code}
          onChange={(e) => onWard(e.target.value)}
          required={required}
          disabled={!value.province_code || loadingWards}
          className={`${inputClass} disabled:opacity-50`}
        >
          <option value="">
            {!value.province_code
              ? t('portal.components.addressPicker.ward_needs_province')
              : loadingWards
                ? t('portal.components.addressPicker.ward_loading')
                : t('portal.components.addressPicker.ward_placeholder')}
          </option>
          {wards.map((w) => (
            <option key={w.code} value={w.code}>
              {w.district ? `${w.name} · ${w.district}` : w.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t('portal.components.addressPicker.detail_label')}</label>
        <input
          type="text"
          value={value.detail}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
          required={required}
          placeholder={t('portal.components.addressPicker.detail_placeholder')}
          className={inputClass}
        />
      </div>
    </div>
  );
}
