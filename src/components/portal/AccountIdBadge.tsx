'use client';

import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

function shortUuid(id: string): string {
  if (id.length <= 17) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

interface Props {
  /** Sequential 6-digit account number — preferred display when available. */
  accountNo?: number | null;
  /** Full UUID — used as copy payload and as fallback display when account_no missing. */
  id?: string | null;
  className?: string;
  size?: 'xs' | 'sm';
}

export function AccountIdBadge({ accountNo, id, className = '', size = 'xs' }: Props) {
  const { t } = useI18n();
  const hasNumber = typeof accountNo === 'number' && Number.isFinite(accountNo);
  const display = hasNumber
    ? String(accountNo).padStart(6, '0')
    : id
      ? shortUuid(id)
      : '—';
  const copyPayload = hasNumber ? String(accountNo) : (id ?? '');

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!copyPayload) return;
    void navigator.clipboard.writeText(copyPayload);
    toast.success(`${t('portal.components.accountIdBadge.toast_copied')}: ${copyPayload}`);
  };
  const textClass = size === 'sm' ? 'text-[11px]' : 'text-[10px]';

  return (
    <button
      type="button"
      onClick={copy}
      title={`${t('portal.components.accountIdBadge.title_copy')}: ${copyPayload}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border border-[#1f2937] bg-[#0a0c0f]/60 px-1.5 py-0.5 ${textClass} font-mono tabular-nums text-[#9ca3af] transition-colors hover:border-[#ff5625]/40 hover:text-[#ff5625] ${className}`}
    >
      <span className="text-[#9ca3af]/70">{t('portal.components.accountIdBadge.id_label')}</span>
      <span className="truncate">{display}</span>
      <span className="material-symbols-outlined text-[12px] opacity-60">content_copy</span>
    </button>
  );
}
