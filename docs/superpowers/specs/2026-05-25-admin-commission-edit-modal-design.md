# Admin Commission Edit Modal — Design Spec

**Date:** 2026-05-25  
**Status:** Approved  

---

## Problem

Admin có thể cài hoa hồng cho dealer **lúc duyệt đăng ký** (trang `/portal/admin/registrations`), nhưng **không có UI để sửa sau khi đã approve**. Dealer không có supervisor thì không ai sửa được commission cho họ.

## Goal

Admin có thể edit hoa hồng cố định (fixed override) của bất kỳ dealer nào — kể cả dealer chưa có supervisor — trực tiếp từ trang `/portal/admin/supervisors`.

## Out of Scope

- Không sửa commission base (% tier tự động) — tier vẫn tính tự động theo units_ytd
- Không reassign supervisor từ modal này
- Không per-model commission (model_id = NULL, áp toàn bộ)

## Constraints

- Giữ range 4.500.000đ – 7.500.000đ (constraint DB hiện tại)
- RPC `supervisor_set_dealer_fixed_commission` đã support admin caller — không cần RPC mới
- Minimum diff: chỉ sửa 3 file (migration + portal-queries.ts + admin/supervisors page)

---

## Architecture

### 1. Migration — `20260525030000_unassigned_dealers_view.sql`

Tạo view `unassigned_dealers_summary`:

```sql
CREATE OR REPLACE VIEW public.unassigned_dealers_summary AS
SELECT
  p.id            AS dealer_id,
  p.full_name     AS dealer_name,
  p.account_no    AS dealer_account_no,
  COUNT(o.id) FILTER (WHERE o.status = 'pending')   AS orders_pending,
  COUNT(o.id) FILTER (WHERE o.status IN ('approved','paid')
    AND date_trunc('month', o.sale_date) = date_trunc('month', CURRENT_DATE)) AS units_ytd,
  COALESCE(SUM(o.sale_price) FILTER (WHERE o.status IN ('approved','paid')
    AND date_trunc('month', o.sale_date) = date_trunc('month', CURRENT_DATE)), 0) AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer'
  AND p.status = 'active'
  AND p.supervisor_id IS NULL
GROUP BY p.id, p.full_name, p.account_no;

GRANT SELECT ON public.unassigned_dealers_summary TO authenticated;
```

RLS: admin xem được qua SECURITY DEFINER hoặc explicit policy.

### 2. `src/lib/portal-queries.ts`

Thêm 2 export:

```ts
// TeamMember.supervisor_id là required string — unassigned dealers không có.
// Dùng type riêng hoặc cast với supervisor_id: '' placeholder.
// Cách đơn giản nhất: export UnassignedDealer = Omit<TeamMember, 'supervisor_id'>
// và dùng union trong component state.

export async function getUnassignedDealers(): Promise<Omit<TeamMember, 'supervisor_id'>[]> {
  const { data } = await getSupabaseClient()
    .from('unassigned_dealers_summary')
    .select('*');
  return (data ?? []) as Omit<TeamMember, 'supervisor_id'>[];
}

// Admin set fixed commission (reuse existing RPC — đã support admin)
export async function adminSetDealerFixedCommission(dealerId: string, amount: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc('supervisor_set_dealer_fixed_commission', {
    p_dealer_id: dealerId,
    p_amount: amount,
  });
  if (error) throw new Error(error.message);
}
```

### 3. `src/app/portal/admin/supervisors/page.tsx`

**Thay đổi:**

a) Import thêm: `getUnassignedDealers`, `getDealerCurrentCommissions`, `adminSetDealerFixedCommission`, `clearDealerFixedCommission`

b) State thêm:
```ts
const [unassigned, setUnassigned] = useState<TeamMember[]>([]);
const [editingDealerId, setEditingDealerId] = useState<string | null>(null);
```

c) `refresh()` fetch thêm `getUnassignedDealers()`

d) Mỗi dealer row trong expand section: thêm nút **"Sửa HH"** → `setEditingDealerId(member.dealer_id)`

e) Section **"Chưa phân công"** ở cuối trang (sau bảng supervisors): bảng dealers unassigned với cùng columns + nút "Sửa HH"

f) `CommissionEditModal` component inline (≤80 dòng):
- Props: `dealerId`, `dealerName`, `onClose`, `onSaved`
- Fetch `getDealerCurrentCommissions([dealerId])` khi mount
- Hiển thị: tier tự động hiện tại (read-only) + slider fixed 4.5M–7.5M + number input
- Buttons: **Lưu** (save fixed) + **Xoá override** (clear, chỉ hiện nếu source === 'fixed') + **Huỷ**
- Overlay style: backdrop-blur, centered, max-w-md — đồng bộ portal dark theme

---

## Data Flow

```
Admin click "Sửa HH" (dealer row)
  → setEditingDealerId(dealer_id)
  → CommissionEditModal mount
  → fetch getDealerCurrentCommissions([dealer_id])
  → render tier info + slider với giá trị hiện tại (nếu có override)
  → Admin kéo slider / nhập số
  → click "Lưu" → adminSetDealerFixedCommission(dealer_id, amount)
  → toast.success → onSaved() → refresh → modal close
```

---

## Test Strategy

1. Dealer có supervisor → admin mở modal → save fixed → toast success → commission hiển thị đúng
2. Dealer không supervisor → xuất hiện trong section "Chưa phân công" → admin set commission → OK
3. Clear override → dealer về tier auto
4. Supervisor thường (không phải admin) không thấy nút "Sửa HH" cho dealer của team khác (RLS đảm bảo ở DB)
