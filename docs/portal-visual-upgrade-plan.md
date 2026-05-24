# Portal Visual Upgrade Plan — Medical Fintech SaaS
**Status:** Ready to execute | **Mobile-first** | **Direction:** Refined Dark + Calm palette

---

## 🚨 CRITICAL — Access Control Fix (P0, implement BEFORE visual upgrade)

**Issue detected 2026-05-23:** Dealer account `dl2.test@dailongai.com` truy cập `/portal/supervisor` → redirect về `/portal/dashboard` thay vì bị block.

**Root cause:** Frontend dùng `router.replace('/portal/dashboard')` khi sai role. Không có:
- Middleware-level route guard
- Dedicated 403 page
- Server-side role enforcement tại route entry

**Risk level:** Medium (data không leak vì RLS + fetch chỉ chạy sau role check, nhưng URL không bị block trực tiếp và behavior không rõ ràng với user)

### Fix Plan

#### Fix 1 — Middleware route guard (highest priority)
**File:** `src/middleware.ts` (tạo mới)

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_ROUTES: Record<string, string[]> = {
  '/portal/supervisor': ['supervisor', 'admin'],
  '/portal/admin': ['admin'],
  '/portal/dealer': ['dealer', 'admin'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is role-protected
  const requiredRoles = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1]

  if (!requiredRoles) return NextResponse.next()

  // Read JWT + profile from Supabase session cookie
  const supabase = createServerClient(...)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/portal/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile?.role || !requiredRoles.includes(profile.role)) {
    return NextResponse.redirect(new URL('/portal/403', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/portal/supervisor/:path*', '/portal/admin/:path*']
}
```

#### Fix 2 — Dedicated 403 page
**File:** `src/app/portal/403/page.tsx`

```
┌────────────────────────────────────────┐
│                                        │
│           🔒  403                      │
│      Không có quyền truy cập           │
│                                        │
│  Tài khoản của bạn không có quyền      │
│  xem trang này.                        │
│                                        │
│  Vai trò hiện tại: [role badge]        │
│                                        │
│  [← Về Dashboard]  [Liên hệ Admin]     │
│                                        │
└────────────────────────────────────────┘
```

Design: dark card centered, lock icon, role display, 2 action buttons.

#### Fix 3 — Replace redirect logic trong tất cả portal pages

**Trước (hiện tại):**
```tsx
if (loading || profile?.role !== 'supervisor') return null; // silent null
```

**Sau:**
```tsx
if (loading) return <PortalSkeleton />; // skeleton (see Loading States)
if (!session) { router.replace('/portal/login'); return null; }
if (profile && profile.role !== 'supervisor') {
  router.replace('/portal/403');  // 403, không phải dashboard
  return null;
}
```

**Files cần update:**
- `src/app/portal/supervisor/page.tsx`
- `src/app/portal/admin/*/page.tsx` (tất cả admin pages)
- `src/app/portal/dealer/*/page.tsx` (dealer-specific pages)

#### Fix 4 — Supabase RLS double-check

Verify các RPCs nhạy cảm có `auth.uid()` check:
- `get_supervisor_funnel()` ✅ (có check)
- `get_supervisor_current_goal()` ✅ (có check)
- `supervisor_set_dealer_fixed_commission()` ✅ (có check)
- `admin_set_supervisor_goal()` ✅ (admin only)
- `admin_record_supervisor_commission()` ✅ (admin only)

Views cần verify: `supervisor_team_summary`, `team_leaderboard` → đã `security_invoker = true` ✅

**Verdict:** Backend/DB layer đã bảo vệ tốt. Frontend cần middleware guard.

---

---

## Design Tokens (already applied via migration 2026-05-23)

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#0a0c0f` | Page background |
| `--bg-card` | `#11151a` | Card surfaces |
| `--bg-elevated` | `#1a1f26` | Elevated/hover state |
| `--bg-deep` | `#06080a` | Sidebar, header |
| `--border` | `#1f2937` | Card borders |
| `--text-primary` | `#e7eaf0` | Main text |
| `--text-muted` | `#9ca3af` | Secondary text |
| `--brand` | `#ff5625` | Orange (CTAs only) |
| `--success` | `#10b981` | Emerald muted |
| `--info` | `#3b82f6` | Medical blue |
| `--warning` | `#f59e0b` | Amber |
| `--danger` | `#f87171` | Soft red |

---

## Phase A — Dealer Portal (Mobile-first priority)
**Files:** `src/components/portal/DealerDashboard.tsx`, `src/app/portal/dealer/commission/page.tsx`
**Effort:** ~4h

### A1. DealerDashboard — Hero section redesign

**Mobile (default):**
```
┌─────────────────────────────────────┐
│ BÁO CÁO THÁNG 05/2026               │
│                                     │
│    29.500.000 ₫                     │  ← font-headline text-[56px] tabular
│    ▁▂▁▃▅▇█▆▃▁ (sparkline 30d)       │  ← SVG 30-bar mini chart
│    1 máy đã chốt tháng này          │
└─────────────────────────────────────┘
```

**Implementation:**
- Component `SparklineBar` — pure SVG, no lib, props: `data: number[]`, `width`, `height`, `color`
- Lấy data từ `orders.filter(o => approved/paid).map(o => sale_price)` group by day last 30d
- Font size: mobile `text-[48px]`, desktop `text-[72px]`
- Sparkline height: 36px mobile, 48px desktop

### A2. DealerDashboard — Radial Tier Donut

Replace current progress bar bằng SVG radial donut:

**Mobile:**
```
┌──────────────────────────────────┐
│  [  TIER 1         ]             │
│  [    ⟳  15%      ]  Còn 100 máy │  ← radial 120x120px
│  [    ĐỒNG        ]     lên BẠC  │
└──────────────────────────────────┘
```

**Implementation: `RadialTierDonut.tsx`**
```tsx
// Pure SVG circle progress
// r=52, circumference=326.7
// strokeDashoffset = circumference * (1 - pct/100)
// Animated: CSS transition stroke-dashoffset 1s ease-out
// Center text: tier name + units_ytd
// Outer ring: gradient từ brand → accent
```

**Anatomy:**
- Track circle: `stroke="#1f2937"` 
- Progress arc: `stroke` linear gradient `#ff5625 → #f59e0b` (warm)
- Center: tier name (font-bold 14px) + units number (font-mono 24px)
- Below: "Còn N máy lên [next tier]"

### A3. DealerDashboard — Activity Feed (replaces recent orders table)

**Mobile (vertical timeline):**
```
ĐƠNN GẦN ĐÂY
│
├─ ● 23/05 14:30  Nguyễn Văn A              ← full row click
│     29.500.000 ₫  ·  1 máy  ·  [● Đã duyệt]
│
├─ ○ 22/05 10:00  Trần Thị B (chờ duyệt)
│     29.500.000 ₫  ·  1 máy  ·  [⏱ Chờ duyệt]
│
└─ ○ 20/05 ...
```

**Implementation:**
- Vertical line: `border-l-2 border-[#1f2937] ml-4`
- Dot: 8x8 circle, màu theo status: `#10b981` approved, `#f59e0b` pending, `#f87171` rejected
- Row: `py-3 px-4 hover:bg-[#1a1f26] rounded-r-xl transition-colors`
- Amount: font-mono font-semibold tabular-nums, large
- Status pill: `rounded-full px-2 py-0.5 text-[10px]` (no uppercase)
- Mobile: full width. Desktop: `max-w-2xl`

### A4. Dealer Commission Page — Grouped Timeline

Replace flat table bằng grouped card list:

**Mobile:**
```
THÁNG 05/2026                     29.500.000 ₫ · 1 đơn
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                    ↑ sticky header khi scroll
  ┌────────────────────────────────────┐
  │ Khách Nguyễn Văn A · 23/05        │
  │ 29.500.000 ₫  ·  ZhiDun CEO       │
  │                                    │
  │ Hoa hồng: 4.425.000 ₫  ·  ● Đã duyệt│
  └────────────────────────────────────┘

THÁNG 04/2026                     0 ₫ · 0 đơn
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (empty state nhẹ)
```

**Implementation:**
- Group bằng `sale_date.slice(0,7)` → `Record<string, LedgerRow[]>`
- Tháng header: sticky `top-[64px]` khi scroll (64px = header height)
- Card: `rounded-2xl border border-[#1f2937]/60 bg-[#11151a] p-4`
- Amount font: `font-headline text-2xl`
- Click card → expand chi tiết (accordion, không modal)
- Empty month: single line "Không có đơn nào trong tháng này."

---

## Phase B — Supervisor Portal
**Files:** `src/app/portal/supervisor/page.tsx`, `src/components/portal/TeamLeaderboard.tsx`, `src/components/portal/FunnelChart.tsx`
**Effort:** ~5h

### B1. Team Tab — Dealer Cards Grid (Desktop upgrade)

Desktop hiện dùng table (min-w-820px). **Đổi desktop sang card grid cũng**.

**Mobile (đã có):** card stack
**Desktop (new):** `grid grid-cols-2 xl:grid-cols-3 gap-4`

**Card anatomy (mobile-first, desktop same):**
```
┌──────────────────────────────────┐
│ [TT] Trần Thị Đại Lý 1           │  ← Avatar circle (gradient) + name
│      ● Hoạt động                 │  ← status badge
│                                  │
│  ▁▂▄▅█▇▄▂▁▃  (30d sparkline)     │  ← reuse SparklineBar
│                                  │
│  29.500.000 ₫   1 máy   0 chờ   │  ← 3-column stats inline
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 💰 15%  [Tự động Tier]    ›  │ │  ← hoa hồng button full-width
│ └──────────────────────────────┘ │
│ [            Chi tiết           ] │  ← secondary link
└──────────────────────────────────┘
```

**Avatar generator:**
- Màu từ `hashCode(dealer_name) % 8` → 8 preset gradient pairs
- Circle 40px, initials 2 chữ cái, font-bold

**Sparkline trong card:**
- Data: lấy từ `supervisor_team_summary` — cần thêm `sales_7d, sales_prev7d` hoặc pull từ `team_leaderboard`
- Fallback: nếu không có daily data, hiện flat line

### B2. Leaderboard — Podium Visual

**Mobile:**
```
PHIÊN NÀY · DOANH SỐ THÁNG

        [2]         [1]         [3]
        🥈          🥇          🥉
    ────────     ──────────   ─────────
    |      |     |        |   |       |
    | 18tr |     | 29.5tr |   | 5tr   |
    ────────     ──────────   ─────────
    Lý 2 (abbr)  Lý 1         Lý 3
    
─ #4  Lý 4  ·  2.5tr          ──────
─ #5  Lý 5  ·  0               ──────
```

**Implementation: `PodiumLeaderboard.tsx` (new component)**
- Replace `TeamLeaderboard.tsx` hoặc export từ cùng file
- Podium heights: 1st = 100px, 2nd = 72px, 3rd = 54px
- Màu: gold #f59e0b, silver #9ca3af, bronze #cd7f32
- Sort toggle (doanh số / máy / 7 ngày) GIỮA — toggle pills style
- List #4-5 bên dưới, flat

### B3. Funnel — Horizontal Stages (Mixpanel-style)

Replace card/bars hiện tại:

**Mobile (vertical stack khi nhỏ, horizontal khi ≥ md):**
```
Mobile: stack dọc

Visitor unique
    ┃  1
    ┃  ━━━━━━━━━━
    ▼  ↓100%

Đăng ký
    ┃  0
    ┃  ────────
    ▼  ↓0%

Đơn đầu tiên
       0
       ─────────

Desktop (horizontal):
[Visitor: 1] →(100%)→ [Đăng ký: 0] →(0%)→ [Đơn đầu: 0]
```

**Implementation:**
- Mobile: `flex-col` + connecting arrows down
- Desktop `md:flex-row` + connecting arrows right
- Stage box: rounded-2xl, có count lớn + label nhỏ
- Arrow connector: `→` với conversion `%` label trên mũi tên
- Color: filled = brand `#ff5625`, empty = dim `#1a1f26`

---

## Phase C — Admin Portal
**Files:** `src/app/portal/admin/orders/page.tsx`, `src/app/portal/admin/audit/page.tsx`
**Effort:** ~5h

### C1. Admin Orders — Kanban Board

**Mobile (column list, horizontal scroll):**
```
Swipe horizontal để xem cột ←→

┌ Chờ duyệt (3) · 88.5M ┐
│ Card 1                 │
│ Card 2                 │
│ Card 3                 │
└────────────────────────┘

→ Đã duyệt → Chờ chi → Đã thanh toán
```

**Desktop (4 columns):**
```
Chờ duyệt    Đã duyệt     Chờ chi      Đã thanh toán
(3) 88.5M    (5) 147M     (2) 59M      (12) 354M

[Card]       [Card]       [Card]        [Card]
[Card]       [Card]       [Card]        [Card]
[Card]                                  ...
```

**Card anatomy:**
```
┌──────────────────────────────┐
│ Trần Thị Đại Lý 1  23/05    │  ← dealer + date
│ KH: Nguyễn Văn A · 1 máy    │
│ 29.500.000 ₫                 │  ← amount bold
│ [✓ Duyệt]    [✗ Từ chối]    │  ← action buttons (chỉ ở cột Chờ duyệt)
└──────────────────────────────┘
```

**Implementation:**
- Column header: sticky top, count + total amount
- Cards: tap/click → expand full detail (accordion trong card)
- Horizontal scroll mobile: `overflow-x-auto snap-x snap-mandatory`, mỗi column `snap-start min-w-[280px]`
- Desktop: `grid grid-cols-4 gap-4`

### C2. Admin Audit — Activity Timeline

**Mobile (vertical timeline full-width):**
```
HÔM NAY — 23/05/2026
│
├─ [👤] 14:23  Đỗ Ngọc Long
│         approved đơn #1969d99
│         Trần Thị Đại Lý 1 · 29.500.000 ₫
│
├─ [🔑] 12:15  Trần Thị Đại Lý 1
│         tạo đơn mới · 29.500.000 ₫
│
HÔM QUA — 22/05/2026
│
└─ [⚙️] 18:22  Hệ thống
          khởi tạo portal messages
```

**Implementation: `AuditTimeline.tsx` (new component)**
- Group by `date_trunc('day', created_at)`
- Date separator: sticky? Or standard divider
- Avatar/icon: per `action_type`
- Icon map:
  - `order_approved` → `✓` circle green
  - `order_rejected` → `✗` circle red
  - `order_created` → `+` circle blue
  - `commission_set` → `💰` circle amber
  - `profile_updated` → `👤` circle gray
  - `payout_processed` → `💸` circle green
- Time: relative "14 phút trước" hoặc absolute nếu > 24h
- Click row → expand full JSON diff (collapse by default)

---

## Phase D — Shared Components (new files to create)

| Component | Path | Usage |
|---|---|---|
| `SparklineBar.tsx` | `components/portal/` | DealerDashboard, Dealer card |
| `RadialTierDonut.tsx` | `components/portal/` | DealerDashboard |
| `PodiumLeaderboard.tsx` | `components/portal/` | Supervisor |
| `AuditTimeline.tsx` | `components/portal/` | Admin audit |
| `OrderKanban.tsx` | `components/portal/` | Admin orders |

---

## Execution Order (rolling deploy)

```
1. Phase D shared components (SparklineBar, RadialTierDonut)
   ↓
2. Phase A Dealer updates (DealerDashboard + commission) → deploy #1
   ↓
3. Phase D PodiumLeaderboard
   ↓
4. Phase B Supervisor updates → deploy #2
   ↓
5. Phase D AuditTimeline + OrderKanban
   ↓
6. Phase C Admin updates → deploy #3
```

---

## Mobile-first Checklist (apply to every component)

- [ ] Default layout vertical/stack (1 column)
- [ ] `md:` prefix cho desktop grid/flex changes
- [ ] Touch targets ≥ 44px (py-3 minimum for buttons/rows)
- [ ] Horizontal scroll với `snap-x snap-mandatory` cho swipeable
- [ ] No fixed widths — `w-full` first, constrain on md:
- [ ] Test at 375px (iPhone SE) — tightest viewport
- [ ] Avoid `min-w-[Xpx]` table tricks (replaced by cards)
- [ ] Font size: min 14px body, min 12px labels
- [ ] Active/pressed states: `active:scale-[0.98]` on buttons
- [ ] Pull-to-refresh safe zones (don't block scroll)

---

## Animation spec (Framer Motion / CSS)

| Element | Animation | Duration |
|---|---|---|
| Card mount | `opacity: 0→1, y: 8→0` | 200ms |
| Radial donut | `stroke-dashoffset` CSS transition | 800ms ease-out |
| Kanban column count | count-up via `requestAnimationFrame` | 600ms |
| Timeline items | Staggered fade-in `delay: i*40ms` | 150ms each |
| Podium bars | Height expand from 0 | 600ms staggered |
| Sparkline bars | Width from 0 | 400ms staggered |
| Number change | Subtle scale 1→1.05→1 | 300ms |

---

## Phase E — Loading States (implement WITH each phase, not after)

Every page/component fetch cần loading state. Hiện tại portal return `null` khi loading → blank flash.

### E1. Page-level Skeleton — `PortalSkeleton.tsx`

```
┌─────────────────────────────────────┐
│ ████████████████  (heading 40%)     │  ← shimmer animation
│                                     │
│ ┌──────────┐  ┌──────────┐          │
│ │██████████│  │██████████│          │  ← 2 card skeletons
│ │    ██    │  │    ██    │          │
│ │  ██████  │  │  ██████  │          │
│ └──────────┘  └──────────┘          │
│                                     │
│ ████████████████████████ (table row)│  ← 3 row skeletons
│ ████████████████████                │
│ ██████████████████████████          │
└─────────────────────────────────────┘
```

**Shimmer CSS (add to globals.css):**
```css
@keyframes skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    #1a1f26 25%,
    #232830 50%,
    #1a1f26 75%
  );
  background-size: 800px 100%;
  animation: skeleton-shimmer 1.4s infinite linear;
  border-radius: 6px;
}
```

**`PortalSkeleton` component anatomy:**
```tsx
// Generic skeleton block
function SkeletonBlock({ w, h, className }: { w?: string; h?: string; className?: string }) {
  return <div className={`skeleton ${w ?? 'w-full'} ${h ?? 'h-4'} ${className ?? ''}`} />
}

// Per-page variants:
// PortalSkeleton.Dashboard — big number + 2 cards + list rows
// PortalSkeleton.Table — filter bar + 5 table rows  
// PortalSkeleton.Cards — 2x3 grid of card outlines
// PortalSkeleton.Ledger — month header + 3 cards
```

### E2. Inline component spinners

Khi user trigger action (submit, approve, set commission):

```tsx
// Spinner component — pure CSS, no lib
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      className="animate-spin text-current"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor"
        strokeWidth="3" strokeDasharray="31.4 31.4"
        strokeLinecap="round" fill="none" opacity="0.3" />
      <path d="M12 2 a10 10 0 0 1 10 10"
        stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" fill="none" />
    </svg>
  )
}
```

Usage in buttons:
```tsx
<button disabled={busy}>
  {busy ? <Spinner size={16} /> : <span>Lưu</span>}
</button>
```

### E3. Loading states per page

| Page | Current state | Loading state to add |
|---|---|---|
| DealerDashboard | `return null` if loading | `PortalSkeleton.Dashboard` |
| Dealer commission | `return null` | `PortalSkeleton.Ledger` |
| Supervisor dashboard | `return null` | `PortalSkeleton.Cards` |
| Admin orders | `return null` | `PortalSkeleton.Table` |
| Admin audit | `return null` | `PortalSkeleton.Table` |
| TierCard | `setLoading(true)` + blank | shimmer block 120px×120px |
| MonthlyGoalCard | empty state only | shimmer full-width 80px |
| FunnelChart | `h-24 animate-pulse` (exists ✅) | keep |
| TeamLeaderboard | no loading state | shimmer 5 rows |
| SupervisorIncomeSummary | no loading state | shimmer 6 bar columns |

### E4. Data refetch + stale indicators

Khi data cũ (>5min) và user còn trên trang:
- Subtle "Đang cập nhật..." top-right, size 11px, fade-in-out
- Không block UI
- Implementation: `useEffect` với `setInterval(refetch, 5*60*1000)`

### E5. Error states

Khi fetch fail (network, 5xx):
```
┌───────────────────────────────┐
│  ⚠️  Không tải được dữ liệu   │
│  Kiểm tra kết nối và thử lại  │
│                               │
│        [Thử lại]              │
└───────────────────────────────┘
```
- `rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-6`
- Retry button calls the original fetch function

---

## Notes

- **Framer Motion** already installed in project
- **No new npm packages** needed — pure SVG + Tailwind + Framer Motion
- **Performance:** all viz components are pure SVG/CSS, no canvas
- **Accessibility:** all interactive elements have `aria-label`, color contrast AA
- **i18n:** all strings tiếng Việt inline (no i18n keys for portal-specific content)
- **Data:** all components receive props from parent — no internal data fetching
- **Fallback:** if data = empty/0, show elegant empty state (not blank/broken)
- **Loading:** every `return null` while loading → replace với PortalSkeleton variant
- **Access:** middleware check BEFORE page render — no data fetched for unauthorized users
