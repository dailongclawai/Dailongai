// Professional multi-sheet Excel commission report for dealer + supervisor.
//
// Sheets (in order):
//   1. Tổng quan       — branded header + report period + key totals
//   2. Chi tiết đơn    — full ledger with VND number format
//   3. Theo tháng      — pivot by sale month
//   4. Theo trạng thái — pivot by status bucket
//   5. Theo đại lý     — pivot by dealer (supervisor only)
//
// Cell features used: VND number format, auto column widths, frozen header row,
// merged title cells. (No bold/colours — vanilla xlsx@0.18 doesn't support those.)

import * as XLSX from 'xlsx';
import type { LedgerRow, SupervisorLedgerRow } from './portal-queries';

type Row = LedgerRow | SupervisorLedgerRow;

const VND_FMT = '#,##0 [$₫-vi-VN]';
const COMPANY = 'CÔNG TY TNHH CÔNG NGHỆ VÀ Y TẾ ĐẠI LONG';
const BRAND_NOTE = 'Báo cáo hoa hồng tự động — không thay thế phiếu kế toán chính thức';

interface Stats { count: number; sale_total: number; commission_total: number; }
function blankStats(): Stats { return { count: 0, sale_total: 0, commission_total: 0 }; }

function classify(r: Row): 'paid' | 'approved' | 'pending' | 'rejected' | 'voided' {
  if (r.status === 'rejected') return 'rejected';
  const c = r.commission;
  if (c?.voided_at) return 'voided';
  if (c?.paid_at) return 'paid';
  if (c) return 'approved';
  return 'pending';
}

const STATUS_LABEL: Record<ReturnType<typeof classify>, string> = {
  paid: 'Đã chi hoa hồng',
  approved: 'Đã duyệt · chờ chi',
  pending: 'Chờ duyệt',
  rejected: 'Bị từ chối',
  voided: 'Đã huỷ',
};

function vndCell(n: number): XLSX.CellObject {
  return { t: 'n', v: n, z: VND_FMT };
}

function dateCell(s: string | null | undefined): XLSX.CellObject {
  return { t: 's', v: s ?? '' };
}

/** Insert AoA into worksheet with merged title row(s) on top. */
function buildSheet(
  titleLines: string[],
  header: string[],
  body: XLSX.CellObject[][],
  colWidths: number[],
): XLSX.WorkSheet {
  const aoa: (string | XLSX.CellObject | null)[][] = [];
  for (const line of titleLines) aoa.push([line]);
  aoa.push([]);
  aoa.push(header);
  for (const row of body) aoa.push(row);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));
  // Merge title rows across the header width.
  ws['!merges'] = titleLines.map((_, i) => ({
    s: { r: i, c: 0 }, e: { r: i, c: header.length - 1 },
  }));
  // Freeze the row right under the header.
  ws['!freeze'] = { ySplit: titleLines.length + 2 };
  ws['!views'] = [{ state: 'frozen', ySplit: titleLines.length + 2, xSplit: 0 }];
  return ws;
}

function fmtPeriod(rows: Row[]): string {
  if (!rows.length) return 'Không có dữ liệu';
  const dates = rows.map((r) => r.sale_date).filter(Boolean).sort();
  if (!dates.length) return 'Không có dữ liệu';
  return `${dates[0]} → ${dates[dates.length - 1]}`;
}

function aggregateBy<K extends string>(
  rows: Row[],
  keyOf: (r: Row) => K | null,
): Map<K, Stats> {
  const out = new Map<K, Stats>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    const s = out.get(k) ?? blankStats();
    s.count += 1;
    s.sale_total += Number(r.sale_price);
    if (r.commission && !r.commission.voided_at) s.commission_total += Number(r.commission.amount);
    out.set(k, s);
  }
  return out;
}

interface ReportContext {
  ownerName: string;
  ownerRole: 'dealer' | 'supervisor';
}

export function exportCommissionReport(rows: Row[], ctx: ReportContext): void {
  const generatedAt = new Date().toLocaleString('vi-VN', { hour12: false });
  const period = fmtPeriod(rows);

  // Aggregate totals
  let totSale = 0, totCommApproved = 0, totCommPaid = 0;
  const buckets = { paid: blankStats(), approved: blankStats(), pending: blankStats(), rejected: blankStats(), voided: blankStats() };
  for (const r of rows) {
    totSale += Number(r.sale_price);
    const b = classify(r);
    buckets[b].count += 1;
    buckets[b].sale_total += Number(r.sale_price);
    if (r.commission && !r.commission.voided_at) {
      const a = Number(r.commission.amount);
      buckets[b].commission_total += a;
      if (r.commission.paid_at) totCommPaid += a;
      else totCommApproved += a;
    }
  }

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: 'Báo cáo hoa hồng Đại Long',
    Subject: ctx.ownerName,
    Author: COMPANY,
    Company: COMPANY,
    CreatedDate: new Date(),
  };

  // ── Sheet 1: Tổng quan ──
  {
    const titleLines = [
      COMPANY,
      'BÁO CÁO HOA HỒNG',
      `${ctx.ownerRole === 'supervisor' ? 'Supervisor' : 'Đại lý'}: ${ctx.ownerName}`,
      `Kỳ báo cáo: ${period}`,
      `Xuất lúc: ${generatedAt}`,
      BRAND_NOTE,
    ];
    const header = ['Chỉ số', 'Số đơn', 'Doanh thu (₫)', 'Hoa hồng (₫)'];
    const body: XLSX.CellObject[][] = [
      [{ t: 's', v: 'Tổng' }, { t: 'n', v: rows.length }, vndCell(totSale), vndCell(totCommApproved + totCommPaid)],
      [{ t: 's', v: STATUS_LABEL.paid }, { t: 'n', v: buckets.paid.count }, vndCell(buckets.paid.sale_total), vndCell(buckets.paid.commission_total)],
      [{ t: 's', v: STATUS_LABEL.approved }, { t: 'n', v: buckets.approved.count }, vndCell(buckets.approved.sale_total), vndCell(buckets.approved.commission_total)],
      [{ t: 's', v: STATUS_LABEL.pending }, { t: 'n', v: buckets.pending.count }, vndCell(buckets.pending.sale_total), vndCell(0)],
      [{ t: 's', v: STATUS_LABEL.rejected }, { t: 'n', v: buckets.rejected.count }, vndCell(buckets.rejected.sale_total), vndCell(0)],
      [{ t: 's', v: STATUS_LABEL.voided }, { t: 'n', v: buckets.voided.count }, vndCell(buckets.voided.sale_total), vndCell(buckets.voided.commission_total)],
    ];
    XLSX.utils.book_append_sheet(wb, buildSheet(titleLines, header, body, [32, 10, 22, 22]), 'Tổng quan');
  }

  // ── Sheet 2: Chi tiết đơn ──
  {
    const isSupervisor = ctx.ownerRole === 'supervisor';
    const header = [
      'Serial', isSupervisor ? 'Đại lý' : null, 'Khách hàng', 'Doanh thu (₫)',
      'Hoa hồng (₫)', 'Trạng thái', 'Ngày bán', 'Ngày chi',
    ].filter((c): c is string => c !== null);
    const widths = isSupervisor ? [16, 22, 22, 16, 16, 22, 12, 12] : [16, 22, 16, 16, 22, 12, 12];

    const body: XLSX.CellObject[][] = rows.map((r) => {
      const b = classify(r);
      const commVal = r.commission && !r.commission.voided_at ? Number(r.commission.amount) : 0;
      const baseCells: XLSX.CellObject[] = [{ t: 's', v: r.serial_number ?? '—' }];
      if (isSupervisor) baseCells.push({ t: 's', v: (r as SupervisorLedgerRow).dealer_name ?? '—' });
      baseCells.push(
        { t: 's', v: r.customer_name },
        vndCell(Number(r.sale_price)),
        vndCell(commVal),
        { t: 's', v: STATUS_LABEL[b] },
        dateCell(r.sale_date),
        dateCell(r.commission?.paid_at ?? null),
      );
      return baseCells;
    });
    XLSX.utils.book_append_sheet(wb, buildSheet([
      `${COMPANY} — Chi tiết đơn (${rows.length} dòng)`,
      `Kỳ: ${period}`,
    ], header, body, widths), 'Chi tiết đơn');
  }

  // ── Sheet 3: Theo tháng ──
  {
    const byMonth = aggregateBy(rows, (r) => (r.sale_date || '').slice(0, 7) || null);
    const months = Array.from(byMonth.keys()).sort();
    const header = ['Tháng', 'Số đơn', 'Doanh thu (₫)', 'Hoa hồng (₫)'];
    const body: XLSX.CellObject[][] = months.map((m) => {
      const s = byMonth.get(m)!;
      return [{ t: 's', v: m }, { t: 'n', v: s.count }, vndCell(s.sale_total), vndCell(s.commission_total)];
    });
    XLSX.utils.book_append_sheet(wb, buildSheet([
      `${COMPANY} — Doanh thu theo tháng`, `Kỳ: ${period}`,
    ], header, body, [12, 10, 22, 22]), 'Theo tháng');
  }

  // ── Sheet 4: Theo trạng thái ──
  {
    const header = ['Trạng thái', 'Số đơn', 'Doanh thu (₫)', 'Hoa hồng (₫)'];
    const body: XLSX.CellObject[][] = (Object.keys(buckets) as Array<keyof typeof buckets>).map((k) => {
      const s = buckets[k];
      return [{ t: 's', v: STATUS_LABEL[k] }, { t: 'n', v: s.count }, vndCell(s.sale_total), vndCell(s.commission_total)];
    });
    XLSX.utils.book_append_sheet(wb, buildSheet([
      `${COMPANY} — Phân tích theo trạng thái`, `Kỳ: ${period}`,
    ], header, body, [24, 10, 22, 22]), 'Theo trạng thái');
  }

  // ── Sheet 5: Theo đại lý (supervisor only) ──
  if (ctx.ownerRole === 'supervisor') {
    const byDealer = aggregateBy(rows as SupervisorLedgerRow[], (r) => (r as SupervisorLedgerRow).dealer_name ?? null);
    const names = Array.from(byDealer.keys()).sort((a, b) => (byDealer.get(b)!.sale_total - byDealer.get(a)!.sale_total));
    const header = ['Đại lý', 'Số đơn', 'Doanh thu (₫)', 'Hoa hồng (₫)'];
    const body: XLSX.CellObject[][] = names.map((n) => {
      const s = byDealer.get(n)!;
      return [{ t: 's', v: n }, { t: 'n', v: s.count }, vndCell(s.sale_total), vndCell(s.commission_total)];
    });
    XLSX.utils.book_append_sheet(wb, buildSheet([
      `${COMPANY} — Doanh thu theo đại lý`, `Kỳ: ${period}`,
    ], header, body, [28, 10, 22, 22]), 'Theo đại lý');
  }

  const slug = (ctx.ownerName || ctx.ownerRole)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'baocao';
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bao-cao-hoa-hong-${slug}-${dateStr}.xlsx`);
}
