# Admin Commission Edit Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin có thể edit hoa hồng cố định (fixed override 4.5M–7.5M) của bất kỳ dealer nào — kể cả dealer không có supervisor — từ trang `/portal/admin/supervisors` qua modal popup.

**Architecture:** Thêm view SQL cho dealers chưa có supervisor, thêm query function, thêm translation keys, rồi sửa trang admin/supervisors để render section "Chưa phân công" + nút "Sửa HH" + `CommissionEditModal`. RPC `supervisor_set_dealer_fixed_commission` và `supervisor_clear_dealer_fixed_commission` đã support admin caller — không cần RPC mới.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (postgres + RLS), Tailwind CSS, sonner toast, `useI18n` hook.

---

## File Map

| File | Hành động |
|------|-----------|
| `supabase/migrations/20260525030000_unassigned_dealers_view.sql` | Tạo mới — view `unassigned_dealers_summary` |
| `src/lib/portal-queries.ts` | Sửa — thêm `getUnassignedDealers()` |
| `src/lib/translations/vi.ts` | Sửa — thêm keys mới |
| `src/lib/translations/en.ts` | Sửa — thêm keys mới |
| `src/app/portal/admin/supervisors/page.tsx` | Sửa — thêm modal + unassigned section + edit buttons |

---

## Task 1: Migration — view `unassigned_dealers_summary`

**Files:**
- Create: `supabase/migrations/20260525030000_unassigned_dealers_view.sql`

- [ ] **Step 1: Tạo file migration**

```sql
-- supabase/migrations/20260525030000_unassigned_dealers_view.sql
CREATE OR REPLACE VIEW public.unassigned_dealers_summary AS
SELECT
  p.id                                                                  AS dealer_id,
  p.full_name                                                           AS dealer_name,
  p.account_no                                                          AS dealer_account_no,
  COUNT(o.id) FILTER (
    WHERE o.status = 'pending'
  )::int                                                                AS orders_pending,
  COUNT(o.id) FILTER (
    WHERE o.status IN ('approved', 'paid')
    AND date_trunc('month', o.sale_date) = date_trunc('month', CURRENT_DATE)
  )::int                                                                AS units_ytd,
  COALESCE(SUM(o.sale_price) FILTER (
    WHERE o.status IN ('approved', 'paid')
    AND date_trunc('month', o.sale_date) = date_trunc('month', CURRENT_DATE)
  ), 0)                                                                 AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer'
  AND p.status = 'active'
  AND p.supervisor_id IS NULL
GROUP BY p.id, p.full_name, p.account_no;

GRANT SELECT ON public.unassigned_dealers_summary TO authenticated;
```

- [ ] **Step 2: Apply migration lên Supabase**

```bash
cd ~/Downloads/dai-long-landing
npx supabase db push
```

Expected: migration applied without error. Nếu lỗi permission khi query view sau này → thêm policy `CREATE POLICY "admin_select_unassigned" ON ... FOR SELECT TO authenticated USING (...)` — nhưng thường không cần vì view query profiles/orders dùng caller's RLS và admin đã có quyền.

- [ ] **Step 3: Verify view trả data đúng**

Chạy query test trong Supabase Dashboard SQL Editor:

```sql
SELECT * FROM public.unassigned_dealers_summary LIMIT 5;
```

Expected: trả về các dealer active có `supervisor_id IS NULL`. Nếu empty vì tất cả dealer đã có supervisor → OK, view vẫn hoạt động đúng.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260525030000_unassigned_dealers_view.sql
git commit -m "feat: add unassigned_dealers_summary view for admin commission UI"
```

---

## Task 2: Thêm `getUnassignedDealers()` vào portal-queries.ts

**Files:**
- Modify: `src/lib/portal-queries.ts` (sau function `getAllTeamMembers` ở ~line 502)

- [ ] **Step 1: Thêm type `UnassignedDealer` vào `portal-types.ts`**

Mở `src/lib/portal-types.ts`, tìm interface `TeamMember` (line ~82) và thêm sau nó:

```ts
export interface UnassignedDealer {
  dealer_id: string;
  dealer_name: string | null;
  dealer_account_no: number | null;
  orders_pending: number;
  units_ytd: number;
  month_sales: number;
}
```

- [ ] **Step 2: Import type mới trong portal-queries.ts**

Tìm dòng import đầu file `src/lib/portal-queries.ts`:

```ts
import type { Order, DealerSummary, TeamMember, FleetSummary, ProductModel, CommissionPlan, DealerCurrentCommission, PortalMessage, PayoutRow, AdminPayoutRow, AuditEntry } from './portal-types';
```

Thêm `UnassignedDealer` vào list import:

```ts
import type { Order, DealerSummary, TeamMember, UnassignedDealer, FleetSummary, ProductModel, CommissionPlan, DealerCurrentCommission, PortalMessage, PayoutRow, AdminPayoutRow, AuditEntry } from './portal-types';
```

- [ ] **Step 3: Thêm function `getUnassignedDealers()` sau `getAllTeamMembers`**

Tìm đoạn kết thúc của `getAllTeamMembers` (~line 504–506):

```ts
export async function getAllTeamMembers(): Promise<TeamMember[]> {
  const { data } = await getSupabaseClient().from('supervisor_team_summary').select('*');
  return (data as TeamMember[]) ?? [];
}
```

Thêm ngay sau đó:

```ts
export async function getUnassignedDealers(): Promise<UnassignedDealer[]> {
  const { data } = await getSupabaseClient().from('unassigned_dealers_summary').select('*');
  return (data as UnassignedDealer[]) ?? [];
}
```

- [ ] **Step 4: Verify TypeScript compile**

```bash
cd ~/Downloads/dai-long-landing
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `UnassignedDealer` hoặc `getUnassignedDealers`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal-types.ts src/lib/portal-queries.ts
git commit -m "feat: add UnassignedDealer type and getUnassignedDealers query"
```

---

## Task 3: Thêm translation keys

**Files:**
- Modify: `src/lib/translations/vi.ts`
- Modify: `src/lib/translations/en.ts`

- [ ] **Step 1: Thêm keys vào vi.ts**

Tìm key `'portal.admin.supervisors.unnamed'` trong `src/lib/translations/vi.ts` (hiện là entry cuối cùng của supervisors section, ~line 991). Thêm sau nó:

```ts
    'portal.admin.supervisors.unassigned.title': 'Đại lý chưa phân công',
    'portal.admin.supervisors.unassigned.subtitle': 'Các đại lý active chưa có supervisor quản lý.',
    'portal.admin.supervisors.unassigned.empty': 'Tất cả đại lý đã được phân công supervisor.',
    'portal.admin.supervisors.action.edit_commission': 'Sửa HH',
    'portal.admin.supervisors.modal.title_prefix': 'Hoa hồng ·',
    'portal.admin.supervisors.modal.loading': 'Đang tải...',
    'portal.admin.supervisors.modal.tier_label': 'Tier tự động hiện tại',
    'portal.admin.supervisors.modal.tier_of_sale': 'trên giá bán',
    'portal.admin.supervisors.modal.fixed_label': 'Override cố định / máy',
    'portal.admin.supervisors.modal.fixed_active_badge': 'Đang áp dụng',
    'portal.admin.supervisors.modal.fixed_amount_per_unit': 'Số tiền / máy',
    'portal.admin.supervisors.modal.save_btn': 'Lưu',
    'portal.admin.supervisors.modal.clear_btn': 'Bỏ override',
    'portal.admin.supervisors.modal.cancel_btn': 'Huỷ',
    'portal.admin.supervisors.toast.commission_saved': 'Đã lưu hoa hồng cố định.',
    'portal.admin.supervisors.toast.commission_cleared': 'Đã bỏ override, đại lý dùng tier tự động.',
    'portal.admin.supervisors.toast.commission_error': 'Không lưu được. Kiểm tra lại giá trị.',
```

- [ ] **Step 2: Thêm keys vào en.ts**

Tìm key `'portal.admin.supervisors.unnamed'` trong `src/lib/translations/en.ts` (~line 988). Thêm sau nó:

```ts
    'portal.admin.supervisors.unassigned.title': 'Unassigned Dealers',
    'portal.admin.supervisors.unassigned.subtitle': 'Active dealers not yet assigned to a supervisor.',
    'portal.admin.supervisors.unassigned.empty': 'All active dealers have been assigned to a supervisor.',
    'portal.admin.supervisors.action.edit_commission': 'Edit Comm.',
    'portal.admin.supervisors.modal.title_prefix': 'Commission ·',
    'portal.admin.supervisors.modal.loading': 'Loading...',
    'portal.admin.supervisors.modal.tier_label': 'Current auto-tier',
    'portal.admin.supervisors.modal.tier_of_sale': 'of sale price',
    'portal.admin.supervisors.modal.fixed_label': 'Fixed override / unit',
    'portal.admin.supervisors.modal.fixed_active_badge': 'Active',
    'portal.admin.supervisors.modal.fixed_amount_per_unit': 'Amount / unit',
    'portal.admin.supervisors.modal.save_btn': 'Save',
    'portal.admin.supervisors.modal.clear_btn': 'Remove override',
    'portal.admin.supervisors.modal.cancel_btn': 'Cancel',
    'portal.admin.supervisors.toast.commission_saved': 'Fixed commission saved.',
    'portal.admin.supervisors.toast.commission_cleared': 'Override removed — dealer uses auto-tier.',
    'portal.admin.supervisors.toast.commission_error': 'Could not save. Check the value.',
```

- [ ] **Step 3: Verify TypeScript compile**

```bash
cd ~/Downloads/dai-long-landing
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/translations/vi.ts src/lib/translations/en.ts
git commit -m "feat: add i18n keys for admin commission edit modal"
```

---

## Task 4: Cập nhật trang admin/supervisors — CommissionEditModal + Unassigned section

**Files:**
- Modify: `src/app/portal/admin/supervisors/page.tsx`

### 4a — Thêm imports và state

- [ ] **Step 1: Thêm imports**

Tìm dòng import hiện tại ở đầu file:

```ts
import { getAllSupervisors, getAllTeamMembers } from '@/lib/portal-queries';
import type { SupervisorRow } from '@/lib/portal-queries';
import type { TeamMember } from '@/lib/portal-types';
```

Thay bằng:

```ts
import { getAllSupervisors, getAllTeamMembers, getUnassignedDealers, getDealerCurrentCommissions, setDealerFixedCommission, clearDealerFixedCommission } from '@/lib/portal-queries';
import type { SupervisorRow } from '@/lib/portal-queries';
import type { TeamMember, UnassignedDealer, DealerCurrentCommission } from '@/lib/portal-types';
import { toast } from 'sonner';
```

- [ ] **Step 2: Thêm state cho unassigned dealers và modal**

Tìm dòng state hiện tại trong `AdminSupervisorsPage`:

```ts
  const [openId, setOpenId] = useState<string | null>(null);
```

Thêm ngay sau:

```ts
  const [unassigned, setUnassigned] = useState<UnassignedDealer[]>([]);
  const [editingDealer, setEditingDealer] = useState<{ id: string; name: string } | null>(null);
```

- [ ] **Step 3: Cập nhật refresh() để fetch unassigned dealers**

Tìm hàm `refresh`:

```ts
  const refresh = useCallback(async () => {
    const [sv, tm] = await Promise.all([getAllSupervisors(), getAllTeamMembers()]);
    setSupervisors(sv);
    setTeam(tm);
  }, []);
```

Thay bằng:

```ts
  const refresh = useCallback(async () => {
    const [sv, tm, ua] = await Promise.all([getAllSupervisors(), getAllTeamMembers(), getUnassignedDealers()]);
    setSupervisors(sv);
    setTeam(tm);
    setUnassigned(ua);
  }, []);
```

### 4b — Thêm cột "Hoa hồng" và nút Sửa vào dealer rows trong team expand

- [ ] **Step 4: Thêm header cột vào inner table**

Tìm header của inner table (expand row, ~line 120–126 trong file hiện tại):

```tsx
                            <thead className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">
                              <tr>
                                <th className="px-3 py-2">{t('portal.admin.supervisors.table.dealer')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.month_sales')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.month_units')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.pending_orders')}</th>
                              </tr>
                            </thead>
```

Thêm `<th>` cuối:

```tsx
                            <thead className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">
                              <tr>
                                <th className="px-3 py-2">{t('portal.admin.supervisors.table.dealer')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.month_sales')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.month_units')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.pending_orders')}</th>
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
```

- [ ] **Step 5: Thêm nút Sửa HH vào mỗi dealer row**

Tìm inner tbody rows (~line 129–134):

```tsx
                              {teamOf(sv.id).map((member) => (
                                <tr key={member.dealer_id} className="border-t border-[#1f2937]/40">
                                  <td className="px-3 py-2">{member.dealer_name ?? t('portal.admin.supervisors.unnamed')}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtVnd(Number(member.month_sales))}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{member.units_ytd}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{member.orders_pending}</td>
                                </tr>
                              ))}
```

Thêm `<td>` cuối mỗi row:

```tsx
                              {teamOf(sv.id).map((member) => (
                                <tr key={member.dealer_id} className="border-t border-[#1f2937]/40">
                                  <td className="px-3 py-2">{member.dealer_name ?? t('portal.admin.supervisors.unnamed')}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtVnd(Number(member.month_sales))}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{member.units_ytd}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{member.orders_pending}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => setEditingDealer({ id: member.dealer_id, name: member.dealer_name ?? '' })}
                                      className="text-xs text-[#ff5625] hover:underline"
                                    >
                                      {t('portal.admin.supervisors.action.edit_commission')}
                                    </button>
                                  </td>
                                </tr>
                              ))}
```

### 4c — Thêm section "Đại lý chưa phân công"

- [ ] **Step 6: Thêm section unassigned sau closing `</div>` của bảng supervisors**

Tìm đóng thẻ của div bọc bảng supervisors (cuối JSX trước `</PortalShell>`):

```tsx
      </div>
    </PortalShell>
```

Thêm section trước `</PortalShell>`:

```tsx
      {/* Unassigned dealers */}
      <div className="mt-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.supervisors.unassigned.title')}</p>
        <p className="mt-1 text-xs text-[#e7eaf0]/50">{t('portal.admin.supervisors.unassigned.subtitle')}</p>
        <div className="mt-4 overflow-x-auto overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
              <tr>
                <th className="px-4 py-3">{t('portal.admin.supervisors.table.dealer')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.month_sales')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.month_units')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.pending_orders')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {unassigned.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-[#e7eaf0]/50">{t('portal.admin.supervisors.unassigned.empty')}</td></tr>
              ) : unassigned.map((d) => (
                <tr key={d.dealer_id} className="border-t border-[#1f2937]/40 hover:bg-[#1a1f26]/40">
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.dealer_name ?? t('portal.admin.supervisors.unnamed')}</p>
                    <p className="text-[11px] text-[#e7eaf0]/50">#{d.dealer_account_no ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(Number(d.month_sales))}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{d.units_ytd}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#ff5625]">{d.orders_pending}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingDealer({ id: d.dealer_id, name: d.dealer_name ?? '' })}
                      className="text-xs text-[#ff5625] hover:underline"
                    >
                      {t('portal.admin.supervisors.action.edit_commission')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
```

### 4d — Thêm CommissionEditModal

- [ ] **Step 7: Thêm modal render trong JSX của AdminSupervisorsPage**

Ngay trước `</PortalShell>` (sau section unassigned):

```tsx
      {editingDealer && (
        <CommissionEditModal
          dealerId={editingDealer.id}
          dealerName={editingDealer.name}
          onClose={() => setEditingDealer(null)}
          onSaved={() => { setEditingDealer(null); void refresh(); }}
        />
      )}
```

- [ ] **Step 8: Thêm component CommissionEditModal cuối file**

Thêm sau export default function (sau dòng `}` kết thúc `AdminSupervisorsPage`):

```tsx
const MIN_FIXED = 4_500_000;
const MAX_FIXED = 7_500_000;
const STEP_FIXED = 100_000;

function CommissionEditModal({
  dealerId,
  dealerName,
  onClose,
  onSaved,
}: {
  dealerId: string;
  dealerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [comm, setComm] = useState<DealerCurrentCommission | null>(null);
  const [amount, setAmount] = useState(MIN_FIXED);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDealerCurrentCommissions([dealerId]).then((map) => {
      const c = map[dealerId] ?? null;
      setComm(c);
      if (c?.source === 'fixed' && c.override_amount) setAmount(c.override_amount);
    });
  }, [dealerId]);

  const save = async () => {
    setBusy(true);
    try {
      await setDealerFixedCommission(dealerId, amount);
      toast.success(t('portal.admin.supervisors.toast.commission_saved'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.admin.supervisors.toast.commission_error'));
    } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await clearDealerFixedCommission(dealerId);
      toast.success(t('portal.admin.supervisors.toast.commission_cleared'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.admin.supervisors.toast.commission_error'));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/60 bg-[#0d1117] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
          {t('portal.admin.supervisors.modal.title_prefix')} {dealerName || t('portal.admin.supervisors.unnamed')}
        </p>

        {comm === null ? (
          <p className="mt-4 text-sm text-[#e7eaf0]/60">{t('portal.admin.supervisors.modal.loading')}</p>
        ) : (
          <>
            {/* Tier auto */}
            <div className="mt-4 rounded-xl border border-[#10b981]/30 bg-[#10b981]/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#10b981]">{t('portal.admin.supervisors.modal.tier_label')}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="font-headline text-lg">{comm.tier_label}</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-[#10b981]">
                  {comm.tier_percent}% <span className="text-xs font-normal text-[#e7eaf0]/40">{t('portal.admin.supervisors.modal.tier_of_sale')}</span>
                </p>
              </div>
            </div>

            {/* Fixed override */}
            <div className="mt-3 rounded-xl border border-[#ff5625]/30 bg-[#ff5625]/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#ff5625]">{t('portal.admin.supervisors.modal.fixed_label')}</p>
                {comm.source === 'fixed' && (
                  <span className="rounded-full bg-[#ff5625]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5625]">
                    {t('portal.admin.supervisors.modal.fixed_active_badge')}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[11px] text-[#e7eaf0]/50">{t('portal.admin.supervisors.modal.fixed_amount_per_unit')}</span>
                <span className="font-mono text-xl font-bold tabular-nums text-[#ff5625]">
                  {amount.toLocaleString('vi-VN')} <span className="text-sm text-[#e7eaf0]/50">₫</span>
                </span>
              </div>
              <input
                type="range" min={MIN_FIXED} max={MAX_FIXED} step={STEP_FIXED}
                value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-2 w-full accent-[#ff5625]"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[#e7eaf0]/40">
                <span>{MIN_FIXED.toLocaleString('vi-VN')} ₫</span>
                <span>{MAX_FIXED.toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number" min={MIN_FIXED} max={MAX_FIXED} step={100_000}
                  value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                  className="flex-1 rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-1.5 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]"
                />
                <button
                  onClick={save} disabled={busy || amount < MIN_FIXED || amount > MAX_FIXED}
                  className="rounded-lg bg-[#ff5625] px-4 py-2 text-xs font-bold text-white hover:bg-[#ff5625]/90 disabled:opacity-50"
                >
                  {t('portal.admin.supervisors.modal.save_btn')}
                </button>
              </div>
              {comm.source === 'fixed' && (
                <button
                  onClick={clear} disabled={busy}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1f2937]/50 px-3 py-2 text-[11px] text-[#e7eaf0]/70 hover:border-[#10b981]/40 hover:text-[#10b981] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">backspace</span>
                  {t('portal.admin.supervisors.modal.clear_btn')}
                </button>
              )}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-[#1f2937]/50 py-2 text-xs text-[#e7eaf0]/60 hover:text-[#e7eaf0]"
        >
          {t('portal.admin.supervisors.modal.cancel_btn')}
        </button>
      </div>
    </div>
  );
}
```

### 4e — Verify và commit

- [ ] **Step 9: TypeScript check**

```bash
cd ~/Downloads/dai-long-landing
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. Fix any import errors nếu có (thường là quên import `useState`/`useEffect` mới, hoặc `DealerCurrentCommission` chưa import).

- [ ] **Step 10: Build check**

```bash
cd ~/Downloads/dai-long-landing
npx next build 2>&1 | tail -20
```

Expected: build succeeds (exit 0).

- [ ] **Step 11: Commit**

```bash
git add src/app/portal/admin/supervisors/page.tsx
git commit -m "feat: add admin commission edit modal for all dealers incl. unassigned"
```

---

## Task 5: Manual QA

- [ ] **Step 1: Chạy dev server**

```bash
cd ~/Downloads/dai-long-landing
npx next dev
```

- [ ] **Step 2: Login admin và kiểm tra trang Supervisors**

Truy cập `http://localhost:3000/portal/admin/supervisors`. Kiểm tra:
- Bảng supervisors vẫn hiển thị đúng
- Expand team → mỗi dealer row có nút "Sửa HH" ở cột cuối
- Section "Đại lý chưa phân công" hiển thị ở cuối trang

- [ ] **Step 3: Test modal**

Click "Sửa HH" trên bất kỳ dealer → modal mở:
- Tier auto card hiển thị % đúng
- Slider và input số hoạt động
- Click ngoài modal → đóng lại

- [ ] **Step 4: Test save fixed commission**

Kéo slider → click "Lưu" → toast "Đã lưu hoa hồng cố định." → modal đóng. Mở lại modal cho dealer đó → badge "Đang áp dụng" xuất hiện, slider ở giá trị đã lưu.

- [ ] **Step 5: Test clear override**

Mở modal dealer đang có override (badge "Đang áp dụng") → click "Bỏ override" → toast "Đã bỏ override" → modal đóng. Mở lại → badge biến mất.

- [ ] **Step 6: Deploy production**

```bash
cd ~/Downloads/dai-long-landing
npx next build && npx wrangler pages deploy out --project-name dai-long-landing
```

Expected: deploy link trả về, trang live trên Cloudflare Pages.

---

## Task 6: Final Verification Gate (bắt buộc trước khi báo done)

> **REQUIRED:** Invoke `superpowers:verification-before-completion` skill. Không được claim "xong/done/✅" nếu chưa có tool output làm bằng chứng.

- [ ] **Step 1: TypeScript clean build**

```bash
cd ~/Downloads/dai-long-landing
npx tsc --noEmit 2>&1
```

Expected: zero errors. Paste output vào response.

- [ ] **Step 2: Next.js build**

```bash
cd ~/Downloads/dai-long-landing
npx next build 2>&1 | tail -10
```

Expected: `✓ Compiled` hoặc `Route (app)` table, exit 0. Paste output.

- [ ] **Step 3: Invoke verification-before-completion skill**

Invoke `superpowers:verification-before-completion` với evidence từ Step 1+2 trước khi báo cáo hoàn thành.
